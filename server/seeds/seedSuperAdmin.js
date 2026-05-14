require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const seedSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('Connected to MongoDB');

    // Super admin credentials - change these as needed
    const superAdminData = {
      email: 'superadmin@testfyrwanda.com',
      password: 'SuperAdmin123!',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',  // System-level super admin role
      userType: 'organization',
      organization: 'TestFy Rwanda',
      phone: '+250700000000'
    };

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ email: superAdminData.email });

    if (existingAdmin) {
      console.log('Super admin already exists:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);

      // Update role to superadmin if not already
      if (existingAdmin.role !== 'superadmin') {
        existingAdmin.role = 'superadmin';
        await existingAdmin.save();
        console.log('Updated role to superadmin');
      }

      process.exit(0);
    }

    // Create super admin
    const superAdmin = new User(superAdminData);
    await superAdmin.save();

    console.log('✅ Super admin created successfully!');
    console.log('Email:', superAdmin.email);
    console.log('Role:', superAdmin.role);
    console.log('Organization:', superAdmin.organization);
    console.log('\nYou can now login with:');
    console.log('Email: superadmin@testfyrwanda.com');
    console.log('Password: SuperAdmin123!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding super admin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
