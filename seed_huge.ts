import { WoopORM, Model, Entity, Column } from './src';

// Define Models
@Entity('users')
class User extends Model {
  @Column() id!: number;
  @Column() name!: string;
  @Column() email!: string;
  @Column() age!: number;
  @Column() is_active!: boolean;
  @Column() created_at!: Date;
}

@Entity('posts')
class Post extends Model {
  @Column() id!: number;
  @Column() user_id!: number;
  @Column() title!: string;
  @Column() content!: string;
  @Column() views!: number;
  @Column() published!: boolean;
  @Column() created_at!: Date;
}

// Random helpers
const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];
const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "example.com", "woop.com"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  return `${randomElement(firstNames)} ${randomElement(lastNames)}`;
}

function randomEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/ /g, '.');
  return `${cleanName}${randomInt(1, 999999)}.${Date.now().toString().slice(-4)}@${randomElement(domains)}`;
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Main Seed Function
async function seed() {
  console.log("Initializing WoopORM for seeding...");

  WoopORM.connect({
    type: 'postgres',
    connectionString: process.env.DATABASE_URL || 'postgres://woop:woop_password@localhost:5434/woop_db',
  });

  const adapter = WoopORM.getAdapter();

  try {
    console.log("Dropping tables...");
    await adapter.query(`DROP TABLE IF EXISTS posts`);
    await adapter.query(`DROP TABLE IF EXISTS users`);

    console.log("Creating tables...");
    await adapter.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email_address TEXT NOT NULL UNIQUE,
        age INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await adapter.query(`
      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title TEXT NOT NULL,
        content TEXT,
        views INTEGER DEFAULT 0,
        published BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Generating Users...");
    const userValues: any[] = [];
    const USER_COUNT = 1000;
    
    // We will use raw SQL for speed
    // Batch size of 100
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < USER_COUNT; i++) {
        const name = randomName();
        userValues.push([
            name,
            randomEmail(name),
            randomInt(18, 90),
            Math.random() > 0.1, // 90% active
            randomDate(new Date(2020, 0, 1), new Date())
        ]);
    }

    // Insert Users in Batches
    for (let i = 0; i < userValues.length; i += BATCH_SIZE) {
        const batch = userValues.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map((_, idx) => 
            `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`
        ).join(', ');
        
        const flatValues = batch.flat();
        
        await adapter.query(
            `INSERT INTO users (name, email_address, age, is_active, created_at) VALUES ${placeholders}`,
            flatValues
        );
        process.stdout.write(`\rInserted users: ${Math.min(i + BATCH_SIZE, userValues.length)}/${userValues.length}`);
    }
    console.log("\nUsers inserted.");

    console.log("Generating Posts...");
    // Fetch all user IDs
    const users = await adapter.query('SELECT id FROM users');
    const userIds = users.map((u: any) => u.id);

    const postValues: any[] = [];
    const TOTAL_POSTS = 5000;

    const titles = ["My First Post", "Hello World", "Woop ORM is cool", "TypeScript Tips", "Postgres Performance", "Random Thoughts", "Daily Update", "Project Log"];
    
    for (let i = 0; i < TOTAL_POSTS; i++) {
        postValues.push([
            randomElement(userIds),
            `${randomElement(titles)} ${randomInt(1, 1000)}`,
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            randomInt(0, 10000),
            Math.random() > 0.3, // 70% published
            randomDate(new Date(2021, 0, 1), new Date())
        ]);
    }

    // Insert Posts in Batches
    for (let i = 0; i < postValues.length; i += BATCH_SIZE) {
        const batch = postValues.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map((_, idx) => 
            `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`
        ).join(', ');
        
        const flatValues = batch.flat();
        
        await adapter.query(
            `INSERT INTO posts (user_id, title, content, views, published, created_at) VALUES ${placeholders}`,
            flatValues
        );
        process.stdout.write(`\rInserted posts: ${Math.min(i + BATCH_SIZE, postValues.length)}/${postValues.length}`);
    }
    console.log("\nPosts inserted.");

    console.log("DONE! Huge data seeded.");

  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    await adapter.close();
  }
}

seed();
