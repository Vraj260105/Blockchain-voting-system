require('dotenv').config();
const { testConnection, User } = require('../models');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Test connection
    await testConnection();
    
    // Check if admin user already exists
    const existingAdmin = await User.findByEmail('admin@votingsystem.com');
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Create admin user
    const adminUser = await User.create({
      email: 'admin@votingsystem.com',
      password: 'Admin123!',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'super_admin',
      isVerified: true,
      isActive: true
    });
    
    console.log('✅ Admin user created successfully');
    console.log('📧 Email: admin@votingsystem.com');
    console.log('🔑 Password: Admin123!');
    
    // Create a test voter user
    const testVoter = await User.create({
      email: 'voter@test.com',
      password: 'Voter123!',
      firstName: 'Test',
      lastName: 'Voter',
      role: 'voter',
      isVerified: true,
      isActive: true
    });
    
    console.log('✅ Test voter user created successfully');
    console.log('📧 Email: voter@test.com');
    console.log('🔑 Password: Voter123!');
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

seedDatabase();