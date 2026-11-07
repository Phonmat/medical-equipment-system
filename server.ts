import express from 'express';
import path from 'path';
import fs from 'fs';
import { getUsers, getOrCreateUser } from './src/db/users.ts';
import {
  getAllData,
  saveEquipment,
  saveBulkEquipment,
  deleteEquipmentById,
  deleteAllEquipment,
  saveRepair,
  deleteRepairById,
  saveDecommission,
  deleteDecommissionById,
  saveMaintenance,
  saveBulkMaintenance,
  deleteMaintenanceById,
  saveCalibration,
  saveBulkCalibration,
  deleteCalibrationById,
  savePoolLoan,
  deletePoolLoanById,
  saveDocument,
  deleteDocumentById,
  addDepartmentName,
  deleteDepartmentByName,
  addFacilityName,
  saveFacilityUsageConfig,
  deleteFacilityByName,
  saveAppUser,
  deleteAppUserById,
  seedInitialData,
} from './src/db/data.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Prevent caching of all API endpoints
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // Health check endpoint for Cloud Run
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Real-time Server-Sent Events (SSE) clients
  const sseClients = new Set<express.Response>();

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  function broadcastChange(entityType: string) {
    const payload = JSON.stringify({ type: entityType, time: Date.now() });
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }

  // Active User Sessions (1 User = 1 IP / 1 Active Session at a time)
  interface ActiveUserSession {
    userKey: string;
    userId: string;
    username: string;
    facility: string;
    ip: string;
    clientId: string;
    loginTime: number;
    lastSeen: number;
  }

  const activeUserSessions = new Map<string, ActiveUserSession>();
  const SESSION_TTL_MS = 45 * 1000; // 45s heartbeat timeout

  function getClientIp(req: express.Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    let rawIp = '';
    if (typeof forwarded === 'string' && forwarded.trim()) {
      rawIp = forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      rawIp = forwarded[0].trim();
    } else {
      rawIp = req.socket?.remoteAddress || req.ip || 'unknown';
    }
    if (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    if (rawIp.startsWith('::ffff:')) {
      return rawIp.slice(7);
    }
    return rawIp;
  }

  function buildUserSessionKey(userId?: string, username?: string, facility?: string): string {
    const normUser = (username || '').trim().toLowerCase();
    if (normUser === 'phonmat') return 'superadmin::phonmat';
    if (userId && userId.trim()) return `id::${userId.trim()}`;
    const normFac = (facility || '').trim().toLowerCase();
    return `user::${normUser}::${normFac}`;
  }

  function findExistingSession(userId?: string, username?: string, facility?: string): ActiveUserSession | undefined {
    const normUser = (username || '').trim().toLowerCase();
    const normFac = (facility || '').trim().toLowerCase();
    for (const session of activeUserSessions.values()) {
      if (userId && session.userId && session.userId === userId) {
        return session;
      }
      if (normUser === 'phonmat' && session.username.trim().toLowerCase() === 'phonmat') {
        return session;
      }
      if (
        normUser &&
        session.username.trim().toLowerCase() === normUser &&
        session.facility.trim().toLowerCase() === normFac
      ) {
        return session;
      }
    }
    return undefined;
  }

  function pruneExpiredSessions(): boolean {
    const now = Date.now();
    let removed = false;
    for (const [key, session] of activeUserSessions.entries()) {
      if (now - session.lastSeen > SESSION_TTL_MS) {
        activeUserSessions.delete(key);
        removed = true;
      }
    }
    return removed;
  }

  function getActiveSessionsList(): ActiveUserSession[] {
    pruneExpiredSessions();
    return Array.from(activeUserSessions.values());
  }

  app.get('/api/auth/sessions', (req, res) => {
    res.json({ activeSessions: getActiveSessionsList() });
  });

  app.post('/api/auth/login', (req, res) => {
    pruneExpiredSessions();
    const { userId, username, facility, clientId } = req.body || {};
    if (!username) {
      return res.status(400).json({ allowed: false, error: 'กรุณาระบุชื่อผู้ใช้งาน' });
    }

    const clientIp = getClientIp(req);
    const existing = findExistingSession(userId, username, facility);

    if (existing) {
      const isSameSession =
        existing.ip === clientIp &&
        existing.clientId &&
        clientId &&
        existing.clientId === clientId;

      if (!isSameSession) {
        return res.status(409).json({
          allowed: false,
          error: `บัญชี "${username}" กำลังเข้าสู่ระบบใช้งานอยู่แล้ว (IP: ${existing.ip}) ไม่สามารถ Login ซ้ำในเวลาเดียวกันได้`,
        });
      }
    }

    const userKey = existing?.userKey || buildUserSessionKey(userId, username, facility);
    const now = Date.now();
    const session: ActiveUserSession = {
      userKey,
      userId: String(userId || ''),
      username: String(username).trim(),
      facility: String(facility || '').trim(),
      ip: clientIp,
      clientId: String(clientId || ''),
      loginTime: existing?.loginTime || now,
      lastSeen: now,
    };

    activeUserSessions.set(userKey, session);
    broadcastChange('sessions');
    res.json({ allowed: true, session, activeSessions: getActiveSessionsList() });
  });

  app.post('/api/auth/heartbeat', (req, res) => {
    const expiredRemoved = pruneExpiredSessions();
    const { userId, username, facility, clientId } = req.body || {};
    if (!username) {
      return res.status(400).json({ valid: false });
    }

    const clientIp = getClientIp(req);
    const existing = findExistingSession(userId, username, facility);
    const now = Date.now();

    if (existing) {
      // Check if another IP or another client owns the session
      if (existing.ip !== clientIp || (existing.clientId && clientId && existing.clientId !== clientId)) {
        return res.status(409).json({
          valid: false,
          error: 'บัญชีนี้ถูกใช้งานอยู่บนเครื่องหรือ IP อื่น',
          activeSessions: getActiveSessionsList(),
        });
      }
      existing.lastSeen = now;
      if (userId && !existing.userId) existing.userId = String(userId);
      activeUserSessions.set(existing.userKey, existing);
      if (expiredRemoved) broadcastChange('sessions');
      return res.json({ valid: true, activeSessions: getActiveSessionsList() });
    }

    // Register session if none exists yet (e.g., server restarted while user tab remained open)
    const userKey = buildUserSessionKey(userId, username, facility);
    const session: ActiveUserSession = {
      userKey,
      userId: String(userId || ''),
      username: String(username).trim(),
      facility: String(facility || '').trim(),
      ip: clientIp,
      clientId: String(clientId || ''),
      loginTime: now,
      lastSeen: now,
    };
    activeUserSessions.set(userKey, session);
    broadcastChange('sessions');
    return res.json({ valid: true, activeSessions: getActiveSessionsList() });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { userId, username, facility, clientId } = req.body || {};
    const existing = findExistingSession(userId, username, facility);
    if (existing) {
      if (!clientId || !existing.clientId || existing.clientId === clientId) {
        activeUserSessions.delete(existing.userKey);
        broadcastChange('sessions');
      }
    }
    res.json({ ok: true, activeSessions: getActiveSessionsList() });
  });

  // Cloud SQL Data Endpoints
  app.get('/api/data', async (req, res) => {
    try {
      const data = await getAllData();
      res.json({
        ...data,
        activeSessions: getActiveSessionsList(),
      });
    } catch (error: any) {
      console.error('Failed to get data:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch data' });
    }
  });

  // Export Project Source Code as ZIP
  app.get('/api/export/project-zip', async (req, res) => {
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const rootDir = process.cwd();

      const ignoredNames = new Set([
        'node_modules',
        'dist',
        '.git',
        '.cache',
        '.next',
        '.env',
        'bun.lock',
        'query.js',
        'fix_script.js',
        'test_dom.js',
        'parse_forms.cjs',
      ]);

      async function scanAndZip(dirPath: string, currentZipFolder: any) {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (
            ignoredNames.has(entry.name) ||
            entry.name.startsWith('.tmp') ||
            entry.name.endsWith('.sh')
          ) {
            continue;
          }
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            const subFolder = currentZipFolder.folder(entry.name);
            if (subFolder) {
              await scanAndZip(fullPath, subFolder);
            }
          } else if (entry.isFile()) {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size > 25 * 1024 * 1024) continue; // Skip files > 25MB
            const fileData = await fs.promises.readFile(fullPath);
            currentZipFolder.file(entry.name, fileData);
          }
        }
      }

      await scanAndZip(rootDir, zip);

      zip.file(
        'README-SETUP.md',
        `# ระบบบริหารจัดการเครื่องมือแพทย์ (Medical Equipment Management System)\n\n## วิธีการติดตั้งและรันในเครื่อง (Local Setup)\n\n1. ตรวจสอบว่าได้ติดตั้ง Node.js (เวอร์ชัน 20 หรือสูงกว่า) เรียบร้อยแล้ว\n2. แตกไฟล์ ZIP นี้ลงในโฟลเดอร์ที่ต้องการ\n3. เปิด Terminal / Command Prompt ในโฟลเดอร์ แล้วสั่งคำสั่ง:\n   \`\`\`bash\n   npm install\n   npm run dev\n   \`\`\`\n4. เปิดเว็บเบราว์เซอร์ไปที่: http://localhost:3000\n`
      );

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="medical-equipment-system-code.zip"'
      );
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Failed to generate project zip:', err);
      res.status(500).json({ error: err.message || 'Failed to export project zip' });
    }
  });

  // Export All Database Records as ZIP (Excel + JSON)
  app.get('/api/export/backup-zip', async (req, res) => {
    try {
      const [{ default: JSZip }, XLSX] = await Promise.all([
        import('jszip'),
        import('xlsx'),
      ]);
      const data = await getAllData();
      const zip = new JSZip();
      const dateStr = new Date().toISOString().split('T')[0];

      // 1. JSON Data files
      const dataFolder = zip.folder('database-json');
      if (dataFolder) {
        dataFolder.file('equipment.json', JSON.stringify(data.equipment || [], null, 2));
        dataFolder.file('repairs.json', JSON.stringify(data.repairs || [], null, 2));
        dataFolder.file('maintenances.json', JSON.stringify(data.maintenances || [], null, 2));
        dataFolder.file('calibrations.json', JSON.stringify(data.calibrations || [], null, 2));
        dataFolder.file('decommissions.json', JSON.stringify(data.decommissions || [], null, 2));
        dataFolder.file('pool_loans.json', JSON.stringify(data.poolLoans || [], null, 2));
        dataFolder.file('departments.json', JSON.stringify(data.departments || [], null, 2));
      }

      // 2. Summary
      const summary = {
        exportedAt: new Date().toISOString(),
        system: 'ระบบบริหารจัดการเครื่องมือแพทย์ (Medical Equipment Management System)',
        totalEquipment: data.equipment?.length || 0,
        totalRepairs: data.repairs?.length || 0,
        totalMaintenances: data.maintenances?.length || 0,
        totalCalibrations: data.calibrations?.length || 0,
        totalDecommissions: data.decommissions?.length || 0,
        totalPoolLoans: data.poolLoans?.length || 0,
        totalDepartments: data.departments?.length || 0,
      };
      zip.file('backup-summary.json', JSON.stringify(summary, null, 2));

      // 3. Multi-sheet Excel file
      const wb = XLSX.utils.book_new();

      // Equipment sheet
      const eqRows = (data.equipment || []).map((eq: any, idx: number) => ({
        'ลำดับ': idx + 1,
        'แผนก': eq.department || '',
        'รหัสเครื่อง (ID CODE)': eq.code || '',
        'Itris ID': eq.itrisId || '',
        'ชื่อเครื่องมือ': eq.name || '',
        'ผู้ผลิต': eq.manufacturer || '',
        'รุ่น': eq.model || '',
        'Serial Number': eq.serialNumber || '',
        'ระดับความเสี่ยง': eq.riskLevel || '',
        'วันที่จัดซื้อ': eq.purchaseDate || '',
        'วันที่ติดตั้ง': eq.installationDate || '',
        'วันขึ้นทะเบียน': eq.registrationDate || '',
        'ราคา (บาท)': eq.purchase || '',
        'ผู้แทนจำหน่าย': eq.vendorCompany || '',
        'สถานะ': eq.status || '',
      }));
      const wsEq = XLSX.utils.json_to_sheet(eqRows);
      XLSX.utils.book_append_sheet(wb, wsEq, 'ทะเบียนเครื่องมือ');

      // Repairs sheet
      const repairRows = (data.repairs || []).map((r: any, idx: number) => {
        const eq = (data.equipment || []).find((e: any) => e.id === r.equipmentId);
        return {
          'ลำดับ': idx + 1,
          'รหัสใบแจ้งซ่อม': r.jobNo || r.id || '',
          'รหัสเครื่อง': r.equipmentCode || eq?.code || (r.isNonRegistered ? 'นอกทะเบียน' : ''),
          'ชื่อเครื่องมือ': r.equipmentName || eq?.name || '',
          'แผนก': r.department || eq?.department || '',
          'อาการเสีย': r.issue || r.symptom || '',
          'สถานะ': r.status || '',
          'วันที่แจ้งซ่อม': r.reportDate || r.reportedDate || '',
          'ผู้แจ้ง': r.signerName || r.reportedBy || r.reporter || '',
          'ช่างผู้รับผิดชอบ': r.technician || '',
        };
      });
      const wsRepair = XLSX.utils.json_to_sheet(repairRows);
      XLSX.utils.book_append_sheet(wb, wsRepair, 'ประวัติงานซ่อม');

      // Maintenance sheet
      const maintRows = (data.maintenances || []).map((m: any, idx: number) => {
        const eq = (data.equipment || []).find((e: any) => e.id === m.equipmentId);
        return {
          'ลำดับ': idx + 1,
          'รหัสเครื่อง': m.equipmentCode || eq?.code || '',
          'ชื่อเครื่องมือ': m.equipmentName || eq?.name || '',
          'แผนก': m.department || eq?.department || '',
          'ความถี่': m.frequency || '',
          'วันที่ทำล่าสุด': m.lastDate || '',
          'กำหนดการ PM': m.nextDate || m.scheduledDate || '',
          'สถานะ': m.status || '',
          'ผู้รับผิดชอบ': m.technician || '',
        };
      });
      const wsMaint = XLSX.utils.json_to_sheet(maintRows);
      XLSX.utils.book_append_sheet(wb, wsMaint, 'บำรุงรักษา PM');

      // Calibration sheet
      const calRows = (data.calibrations || []).map((c: any, idx: number) => {
        const eq = (data.equipment || []).find((e: any) => e.id === c.equipmentId);
        return {
          'ลำดับ': idx + 1,
          'รหัสเครื่อง': c.equipmentCode || eq?.code || '',
          'ชื่อเครื่องมือ': c.equipmentName || eq?.name || '',
          'แผนก': c.department || eq?.department || '',
          'ความถี่': c.frequency || '',
          'วันที่ทำล่าสุด': c.lastDate || '',
          'กำหนดสอบเทียบ': c.nextDate || c.scheduledDate || '',
          'สถานะ': c.status || '',
          'หน่วยงานสอบเทียบ': c.agency || c.vendor || '',
          'เลขที่ใบรับรอง': c.certNumber || '',
        };
      });
      const wsCal = XLSX.utils.json_to_sheet(calRows);
      XLSX.utils.book_append_sheet(wb, wsCal, 'แผนสอบเทียบ');

      // Pool Loans sheet
      const poolRows = (data.poolLoans || []).map((p: any, idx: number) => {
        const eq = (data.equipment || []).find((e: any) => e.id === p.equipmentId);
        return {
          'ลำดับ': idx + 1,
          'รหัสเครื่อง': p.equipmentCode || eq?.code || '',
          'ชื่อเครื่องมือ': p.equipmentName || eq?.name || '',
          'ผู้ยืม': p.borrowerName || '',
          'แผนกที่ยืม': p.borrowerDepartment || p.borrowingDepartment || '',
          'วันที่ยืม': p.borrowDate || '',
          'กำหนดคืน': p.expectedReturnDate || '',
          'วันที่คืนจริง': p.actualReturnDate || '',
          'สถานะ': p.status || '',
        };
      });
      const wsPool = XLSX.utils.json_to_sheet(poolRows);
      XLSX.utils.book_append_sheet(wb, wsPool, 'การยืมคืน Pool');

      const excelBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      zip.file(`Medical_System_Full_Database_${dateStr}.xlsx`, excelBuf);

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="medical-system-backup-${dateStr}.zip"`
      );
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Failed to generate backup zip:', err);
      res.status(500).json({ error: err.message || 'Failed to export backup zip' });
    }
  });

  app.post('/api/data/seed', async (req, res) => {
    try {
      const result = await seedInitialData(req.body);
      broadcastChange('seed');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to seed data:', error);
      res.status(500).json({ error: error.message || 'Failed to seed data' });
    }
  });

  app.get('/api/users', async (req, res) => {
    try {
      const usersList = await getUsers();
      res.json(usersList);
    } catch (error: any) {
      console.error('Failed to get users:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  });

  app.post('/api/users/sync', async (req, res) => {
    try {
      const { uid, email, displayName } = req.body;
      if (!uid || !email) {
        return res.status(400).json({ error: 'uid and email are required' });
      }
      const user = await getOrCreateUser(uid, email, displayName);
      broadcastChange('users');
      res.json(user);
    } catch (error: any) {
      console.error('Failed to sync user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // Equipment
  app.post('/api/equipment', async (req, res) => {
    try {
      const result = await saveEquipment(req.body);
      broadcastChange('equipment');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save equipment:', error);
      res.status(500).json({ error: error.message || 'Failed to save equipment' });
    }
  });

  app.post('/api/equipment/bulk', async (req, res) => {
    try {
      const result = await saveBulkEquipment(req.body);
      broadcastChange('equipment');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to bulk save equipment:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk save equipment' });
    }
  });

  app.delete('/api/equipment/clear-all', async (req, res) => {
    try {
      const result = await deleteAllEquipment();
      broadcastChange('equipment');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to clear all equipment:', error);
      res.status(500).json({ error: error.message || 'Failed to clear all equipment' });
    }
  });

  app.delete('/api/equipment/:id', async (req, res) => {
    try {
      const result = await deleteEquipmentById(req.params.id);
      broadcastChange('equipment');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete equipment:', error);
      res.status(500).json({ error: error.message || 'Failed to delete equipment' });
    }
  });

  // Repairs
  app.post('/api/repairs', async (req, res) => {
    try {
      const result = await saveRepair(req.body);
      broadcastChange('repairs');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save repair:', error);
      res.status(500).json({ error: error.message || 'Failed to save repair' });
    }
  });

  app.delete('/api/repairs/:id', async (req, res) => {
    try {
      const result = await deleteRepairById(req.params.id);
      broadcastChange('repairs');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete repair:', error);
      res.status(500).json({ error: error.message || 'Failed to delete repair' });
    }
  });

  // Decommissions
  app.post('/api/decommissions', async (req, res) => {
    try {
      const result = await saveDecommission(req.body);
      broadcastChange('decommissions');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save decommission:', error);
      res.status(500).json({ error: error.message || 'Failed to save decommission' });
    }
  });

  app.delete('/api/decommissions/:id', async (req, res) => {
    try {
      const result = await deleteDecommissionById(req.params.id);
      broadcastChange('decommissions');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete decommission:', error);
      res.status(500).json({ error: error.message || 'Failed to delete decommission' });
    }
  });

  // Maintenances
  app.post('/api/maintenances', async (req, res) => {
    try {
      const result = await saveMaintenance(req.body);
      broadcastChange('maintenances');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save maintenance:', error);
      res.status(500).json({ error: error.message || 'Failed to save maintenance' });
    }
  });

  app.post('/api/maintenances/bulk', async (req, res) => {
    try {
      const result = await saveBulkMaintenance(req.body);
      broadcastChange('maintenances');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save bulk maintenances:', error);
      res.status(500).json({ error: error.message || 'Failed to save bulk maintenances' });
    }
  });

  app.delete('/api/maintenances/:id', async (req, res) => {
    try {
      const result = await deleteMaintenanceById(req.params.id);
      broadcastChange('maintenances');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete maintenance:', error);
      res.status(500).json({ error: error.message || 'Failed to delete maintenance' });
    }
  });

  // Calibrations
  app.post('/api/calibrations', async (req, res) => {
    try {
      const result = await saveCalibration(req.body);
      broadcastChange('calibrations');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save calibration:', error);
      res.status(500).json({ error: error.message || 'Failed to save calibration' });
    }
  });

  app.post('/api/calibrations/bulk', async (req, res) => {
    try {
      const result = await saveBulkCalibration(req.body);
      broadcastChange('calibrations');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save bulk calibrations:', error);
      res.status(500).json({ error: error.message || 'Failed to save bulk calibrations' });
    }
  });

  app.delete('/api/calibrations/:id', async (req, res) => {
    try {
      const result = await deleteCalibrationById(req.params.id);
      broadcastChange('calibrations');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete calibration:', error);
      res.status(500).json({ error: error.message || 'Failed to delete calibration' });
    }
  });

  // Pool Loans
  app.post('/api/pool-loans', async (req, res) => {
    try {
      const result = await savePoolLoan(req.body);
      broadcastChange('pool-loans');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save pool loan:', error);
      res.status(500).json({ error: error.message || 'Failed to save pool loan' });
    }
  });

  app.delete('/api/pool-loans/:id', async (req, res) => {
    try {
      const result = await deletePoolLoanById(req.params.id);
      broadcastChange('pool-loans');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete pool loan:', error);
      res.status(500).json({ error: error.message || 'Failed to delete pool loan' });
    }
  });

  // Documents
  app.post('/api/documents', async (req, res) => {
    try {
      const result = await saveDocument(req.body);
      broadcastChange('documents');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save document:', error);
      res.status(500).json({ error: error.message || 'Failed to save document' });
    }
  });

  app.delete('/api/documents/:id', async (req, res) => {
    try {
      const result = await deleteDocumentById(req.params.id);
      broadcastChange('documents');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      res.status(500).json({ error: error.message || 'Failed to delete document' });
    }
  });

  // Departments
  app.post('/api/departments', async (req, res) => {
    try {
      const { name } = req.body;
      const result = await addDepartmentName(name);
      broadcastChange('departments');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to add department:', error);
      res.status(500).json({ error: error.message || 'Failed to add department' });
    }
  });

  app.delete('/api/departments/:name', async (req, res) => {
    try {
      const result = await deleteDepartmentByName(req.params.name);
      broadcastChange('departments');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete department:', error);
      res.status(500).json({ error: error.message || 'Failed to delete department' });
    }
  });

  // Facilities (สถานประกอบการ)
  app.post('/api/facilities', async (req, res) => {
    try {
      const { name, usageDays } = req.body;
      const result = await addFacilityName(name, usageDays);
      broadcastChange('facilities');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to add facility:', error);
      res.status(500).json({ error: error.message || 'Failed to add facility' });
    }
  });

  app.post('/api/facility-configs', async (req, res) => {
    try {
      const result = await saveFacilityUsageConfig(req.body);
      broadcastChange('facility-configs');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save facility usage config:', error);
      res.status(400).json({ error: error.message || 'Failed to save facility usage config' });
    }
  });

  app.delete('/api/facilities/:name', async (req, res) => {
    try {
      const result = await deleteFacilityByName(req.params.name);
      broadcastChange('facilities');
      broadcastChange('facility-configs');
      broadcastChange('users');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete facility:', error);
      res.status(500).json({ error: error.message || 'Failed to delete facility' });
    }
  });

  // App Users Management
  app.post('/api/app-users', async (req, res) => {
    try {
      const result = await saveAppUser(req.body);
      broadcastChange('users');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to save app user:', error);
      res.status(400).json({ error: error.message || 'Failed to save app user' });
    }
  });

  app.delete('/api/app-users/:id', async (req, res) => {
    try {
      const result = await deleteAppUserById(req.params.id);
      broadcastChange('users');
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete app user:', error);
      res.status(400).json({ error: error.message || 'Failed to delete app user' });
    }
  });

  // Bind port immediately so reverse proxy never sees 502 during Vite warmup
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Vite middleware in development vs Static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer }) =>
      createServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      })
    );
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
