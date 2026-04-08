require('dotenv').config();
const { testConnection, User } = require('../models');

const updateAdmin = async () => {
  try {
    console.log('🔧 Updating admin password...');
    
    // Test connection
    await testConnection();
    
    // Find admin user
    const admin = await User.findByEmail('admin@votingsystem.com');
    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }
    
    // Update password (will be hashed by the model hook)
    await admin.update({ password: 'Admin123!' });
    
    console.log('✅ Admin password updated successfully');
    console.log('📧 Email: admin@votingsystem.com');
    console.log('🔑 Password: Admin123!');
    
  } catch (error) {
    console.error('❌ Failed to update admin password:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

updateAdmin();