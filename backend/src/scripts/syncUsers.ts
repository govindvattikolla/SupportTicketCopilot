import bcrypt from 'bcryptjs';
import { connectDatabase, closeDatabase } from '../config/db';
import { Workspace } from '../modules/workspaces/workspace.model';
import { User } from '../modules/users/user.model';

export const syncAllUsers = async () => {
  await connectDatabase();

  const workspaces = await Workspace.find();
  const pass123 = await bcrypt.hash('Password123!', 10);
  const admin123 = await bcrypt.hash('admin@123', 10);

  const acmeWs = workspaces.find((w) => w.slug === 'acme');
  const slugWs = workspaces.find((w) => w.slug === 'slug');
  const demoWs = workspaces.find((w) => w.slug === 'demo');

  const targets = [
    // Acme workspace
    { email: 'admin@testing.com', name: 'Production Administrator', passwordHash: admin123, role: 'admin' as const, ws: acmeWs },
    { email: 'admin@supportflow.com', name: 'Sarah Admin', passwordHash: pass123, role: 'admin' as const, ws: acmeWs },
    { email: 'admin@acme.com', name: 'Acme Administrator', passwordHash: admin123, role: 'admin' as const, ws: acmeWs },
    { email: 'agent@supportflow.com', name: 'Jordan Agent', passwordHash: pass123, role: 'agent' as const, ws: acmeWs, skills: ['technical', 'general'] },
    { email: 'lead@supportflow.com', name: 'Alex Lead', passwordHash: pass123, role: 'lead' as const, ws: acmeWs, skills: ['billing', 'technical'] },

    // Slug workspace
    { email: 'admin@testing.com', name: 'Production Administrator', passwordHash: admin123, role: 'admin' as const, ws: slugWs },
    { email: 'admin@supportflow.com', name: 'Sarah Admin', passwordHash: pass123, role: 'admin' as const, ws: slugWs },
    { email: 'agent@testing.com', name: 'SupportFlow Agent', passwordHash: admin123, role: 'agent' as const, ws: slugWs, skills: ['technical', 'general'] },

    // Demo workspace
    { email: 'admin@supportflow.com', name: 'Sarah Admin', passwordHash: pass123, role: 'admin' as const, ws: demoWs },
    { email: 'admin@acme.com', name: 'Acme Administrator', passwordHash: pass123, role: 'admin' as const, ws: demoWs },
  ];

  for (const t of targets) {
    if (!t.ws) continue;
    await User.findOneAndUpdate(
      { email: t.email, workspaceId: t.ws._id },
      {
        $set: {
          name: t.name,
          passwordHash: t.passwordHash,
          role: t.role,
          isActive: true,
          skills: t.skills || ['general', 'technical', 'billing'],
          maxCapacity: 10,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`Synced user: ${t.email} in workspace: ${t.ws.slug} (${t.ws.name})`);
  }

  console.log('✅ All workspace users synced successfully.');
  await closeDatabase();
};

syncAllUsers().catch((err) => {
  console.error('Error syncing users:', err);
  process.exit(1);
});
