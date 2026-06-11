require('dotenv').config();
const mongoose = require('mongoose');

async function fixEmailSparseIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Get existing indexes
    const indexes = await collection.indexes();
    console.log('\nExisting indexes:', indexes.map(i => ({ name: i.name, key: i.key })));

    // Find the email_1 index
    const emailIndex = indexes.find(i => i.name === 'email_1');
    
    if (emailIndex) {
      console.log('\nFound email_1 index:', emailIndex);
      
      // Check if it's already sparse
      if (emailIndex.sparse) {
        console.log('✅ email_1 index is already sparse. No action needed.');
      } else {
        console.log('⚠️ email_1 index is NOT sparse. Dropping and recreating...');
        
        // Drop the existing index
        await collection.dropIndex('email_1');
        console.log('✅ Dropped email_1 index');
        
        // Create sparse index
        await collection.createIndex(
          { email: 1 },
          { 
            unique: true, 
            sparse: true,
            name: 'email_1'
          }
        );
        console.log('✅ Created sparse email_1 index');
      }
    } else {
      console.log('⚠️ email_1 index not found. Creating sparse index...');
      await collection.createIndex(
        { email: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'email_1'
        }
      );
      console.log('✅ Created sparse email_1 index');
    }

    // Also check and fix phone index if needed
    const phoneIndex = indexes.find(i => i.name === 'phone_1');
    if (phoneIndex && !phoneIndex.sparse) {
      console.log('\n⚠️ phone_1 index is NOT sparse. Dropping and recreating...');
      await collection.dropIndex('phone_1');
      console.log('✅ Dropped phone_1 index');
      await collection.createIndex(
        { phone: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'phone_1'
        }
      );
      console.log('✅ Created sparse phone_1 index');
    }

    // Verify the new indexes
    const newIndexes = await collection.indexes();
    console.log('\nUpdated indexes:', newIndexes.map(i => ({ name: i.name, key: i.key, sparse: i.sparse })));

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing email sparse index:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixEmailSparseIndex();
