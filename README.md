# Woop ORM

A lightweight TypeScript ORM for PostgreSQL.

## Installation

```bash
bun add pg reflect-metadata
bun add -d @types/pg
```

## Usage

### 1. Initialize Connection

```typescript
import { WoopORM } from './src';

WoopORM.connect({
  type: 'postgres',
  connectionString: process.env.DATABASE_URL,
});
```

### 2. Define a Model (New Easy Syntax!)

Use decorators to define your entities. This is cleaner and safer.

```typescript
import { Model, Entity, Column } from './src';

@Entity('users')
class User extends Model {
  @Column()
  id!: number;

  @Column()
  name!: string;

  @Column({ name: 'email_address' }) // Map to different DB column
  email!: string;
}
```

### 3. Querying

```typescript
// Create (Only decorated properties are sent to DB)
const user = await User.create({
  name: 'Alice',
  email: 'alice@example.com',
});

// Find by ID
const found = await User.find(user.id);

// Custom Query
const users = await User.query()
  .where('email_address', '=', 'alice@example.com') // Use DB column name in queries
  .orderBy('id', 'DESC')
  .limit(10)
  .get();
```

## Features

- **Decorators**: `@Entity` and `@Column` for declarative model definitions.
- **Safety**: Only decorated properties are persisted, preventing accidental errors.
- **Flexibility**: Map class properties to different database column names.
