const { sequelize, User, OTP, AuditLog, UserSession, ActivityLog, ElectionRegistration, ElectionMetadata, VoteNotification } = require('./src/models');

async function checkDatabase() {
  console.log('🔍 Starting deep database schema and data consistency check...');
  
  try {
    // 1. Check connection
    await sequelize.authenticate();
    console.log('✅ Connected to database schema:', sequelize.config.database);
    
    // 2. Test each model by running a simple query (this verifies columns map correctly without crashing)
    const models = [
      { name: 'User', model: User },
      { name: 'OTP', model: OTP },
      { name: 'AuditLog', model: AuditLog },
      { name: 'UserSession', model: UserSession },
      { name: 'ActivityLog', model: ActivityLog },
      { name: 'ElectionRegistration', model: ElectionRegistration },
      { name: 'ElectionMetadata', model: ElectionMetadata },
      { name: 'VoteNotification', model: VoteNotification }
    ];
    
    console.log('\n📊 Testing Data Reads (Schema vs Data alignment)...');
    let errors = 0;
    
    for (const { name, model } of models) {
      if (!model) {
        console.error(`❌ Model ${name} is undefined in models/index.js export!`);
        errors++;
        continue;
      }
      try {
        const count = await model.count();
        const sample = await model.findOne({ order: [['id', 'DESC']] });
        console.log(`✅ ${name}: OK. Found ${count} records. Data row fully parsed.`);
      } catch (err) {
        console.error(`❌ Schema/Data Mismatch in ${name}:`, err.message);
        errors++;
      }
    }
    
    // 3. Test association foreign keys
    console.log('\n🔗 Testing Relation Constraints (Orphaned Data Checks)...');
    
    // For example, do we have UserSessions without a valid user? (This breaks foreign key logic if not CASCADE)
    try {
      const orphanedSessions = await UserSession.count({
        include: [{
          model: User,
          as: 'user',
          required: false
        }],
        where: { '$user.id$': null }
      });
      if (orphanedSessions > 0) {
        console.error(`⚠️ Found ${orphanedSessions} orphaned UserSession records! Data inconsistency.`);
        errors++;
      } else {
        console.log(`✅ UserSession -> User relation: OK (No orphaned).`);
      }
    } catch(err) {
      console.error('❌ Failed testing UserSession->User:', err.message);
      errors++;
    }

    // Do we have ActivityLogs mapped to missing users?
    try {
      const orphanedActivity = await ActivityLog.count({
        include: [{
          model: User,
          as: 'user',
          required: false
        }],
        where: { '$user.id$': null, userId: { [sequelize.Op.not]: null } }
      });
      if (orphanedActivity > 0) {
        console.error(`⚠️ Found ${orphanedActivity} ActivityLog records with invalid userId! Data inconsistency.`);
        errors++;
      } else {
        console.log(`✅ ActivityLog -> User relation: OK (No orphaned).`);
      }
    } catch(err) {
      console.error('❌ Failed testing ActivityLog->User:', err.message);
      errors++;
    }
    
    console.log(`\n🏁 Check finished. Total Errors/Mismatches: ${errors}`);
    
  } catch (error) {
    console.error('❌ Critical database error:', error);
  } finally {
    await sequelize.close();
  }
}

checkDatabase();
