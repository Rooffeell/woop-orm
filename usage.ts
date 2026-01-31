import { WoopORM, Model, Entity, Column } from './src';

// 1. Define a Model using Decorators
@Entity('users')
class User extends Model {
  @Column()
  id!: number;

  @Column()
  name!: string;

  @Column({ name: 'email_address' }) // Map to a different DB column name
  email!: string;

  // This property will be ignored by the ORM
  tempValue?: string; 
}

async function main() {
  console.log("Initializing WoopORM...");

  // 2. Connect
  WoopORM.connect({
    type: 'postgres',
    // Using port 5434 as configured in docker-compose
    connectionString: process.env.DATABASE_URL || 'postgres://woop:woop_password@localhost:5434/woop_db',
  });
  
  console.log("Connected.");

  try {
    // 2.5 Ensure table exists (Quick hack for demo)
    console.log("Ensuring table exists...");
    await WoopORM.getAdapter().query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email_address TEXT NOT NULL
      );
    `);

    // 3. Use Model
    console.log("Creating user...");
    const user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
    });
    console.log("User created:", user);

    const users = await User.all();
    console.log("All users:", users);

  } catch (err) {
    console.error("Error during execution:", err);
  } finally {
    await WoopORM.getAdapter().close();
  }
}

main();
