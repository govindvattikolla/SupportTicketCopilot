import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase, closeDatabase } from '../config/db';
import { Workspace } from '../modules/workspaces/workspace.model';
import { User } from '../modules/users/user.model';

// Load .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const cleanVal = (val?: string): string => {
  if (!val) return '';
  return val.trim().replace(/^['"]|['"]$/g, '').trim();
};

export const initAdmin = async () => {
  const workspaceSlug = (cleanVal(process.env.ADMIN_WORKSPACE_SLUG) || 'main').toLowerCase();
  const workspaceName = cleanVal(process.env.ADMIN_WORKSPACE_NAME) || 'Support Operations';
  const adminEmail = cleanVal(process.env.ADMIN_EMAIL) || 'admin@company.com';
  const adminName = cleanVal(process.env.ADMIN_NAME) || 'Production Administrator';
  const adminPassword = cleanVal(process.env.ADMIN_PASSWORD);

  if (!adminPassword || adminPassword.length < 8) {
    console.error('❌ Error: ADMIN_PASSWORD environment variable (min 8 chars) is required to initialize production admin.');
    console.error('   Usage: ADMIN_PASSWORD="YourSecurePassword!" npm run init:admin');
    process.exit(1);
  }

  await connectDatabase();

  let workspace = await Workspace.findOne({ slug: workspaceSlug });
  if (!workspace) {
    workspace = await Workspace.create({
      name: workspaceName,
      slug: workspaceSlug,
      ticketCounter: 1000,
      settings: {
        defaultPriority: 'P3',
        allowCustomerReopen: true,
      },
    });
    console.log(`✅ Created workspace: ${workspace.name} (${workspace.slug})`);
  } else {
    console.log(`ℹ️  Using existing workspace: ${workspace.name} (${workspace.slug})`);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  let adminUser = await User.findOne({ workspaceId: workspace._id, email: adminEmail.toLowerCase() });
  if (!adminUser) {
    adminUser = await User.create({
      workspaceId: workspace._id,
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
      skills: ['general', 'technical', 'billing'],
      maxCapacity: 10,
    });
    console.log(`✅ Production admin user created: ${adminUser.name} <${adminUser.email}> (Role: ${adminUser.role})`);
  } else {
    adminUser.passwordHash = passwordHash;
    adminUser.name = adminName;
    await adminUser.save();
    console.log(`✅ Production admin user password updated: ${adminUser.name} <${adminUser.email}>`);
  }

  console.log('\n🚀 Workspace is ready for production. Zero seed tickets present.');
  await closeDatabase();
};

if (require.main === module || process.argv[1]?.includes('initAdmin')) {
  initAdmin().catch((err) => {
    console.error('❌ Error initializing production admin:', err);
    process.exit(1);
  });
}
