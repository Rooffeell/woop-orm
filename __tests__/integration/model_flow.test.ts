
import 'reflect-metadata';
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { WoopORM } from "../../src/core/WoopORM";
import { Model } from "../../src/core/Model";
import { Entity, Column } from "../../src/core/Decorators";
import { PostgresQueryBuilder } from "../../src/postgres/PostgresQueryBuilder";
import type { DBAdapter } from "../../src/core/DBAdapter";

// Mock Adapter
const mockAdapter: DBAdapter = {
  connect: mock(async () => {}),
  close: mock(async () => {}),
  query: mock(async (query: string, params?: any[]) => {
    // Return mock data for 'insert' to simulate returning ID
    if (query.startsWith('INSERT')) {
        return [{ id: 1, ...params }]; 
    }
    return []; 
  }),
  createQueryBuilder: mock((table: string) => new PostgresQueryBuilder(mockAdapter, table) as any),
};

@Entity('users')
class User extends Model {
  @Column({ primary: true })
  id!: number;

  @Column()
  username!: string;

  @Column({ name: 'email_address' }) // Different column name
  email!: string;
}

describe("Woop ORM Model Integration Flow", () => {
  
  beforeEach(() => {
    WoopORM.setAdapter(mockAdapter);
    (mockAdapter.query as any).mockClear();
  });

  test("Model.find() should generate correct SQL", async () => {
    await User.find(1);
    
    expect(mockAdapter.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM users WHERE id = $1"),
        [1]
    );
  });

  test("Model.create() should map property names to column names", async () => {
    await User.create({
        username: "john_doe",
        email: "john@example.com"
    });
    
    // email -> email_address
    expect(mockAdapter.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        expect.any(Array)
    );
    
    const callArgs = (mockAdapter.query as any).mock.lastCall;
    const executedQuery = callArgs[0];
    const params = callArgs[1];
    
    // Check column names in query
    expect(executedQuery).toContain("username");
    expect(executedQuery).toContain("email_address"); 
    
    // Check params
    expect(params).toContain("john_doe");
    expect(params).toContain("john@example.com");
  });

  test("Model.save() on new instance should INSERT", async () => {
    const user = new User();
    user.username = "jane_doe";
    user.email = "jane@example.com";
    
    await user.save();
    
    expect(mockAdapter.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        expect.any(Array)
    );
  });

  test("Model.save() on existing instance should UPDATE", async () => {
    const user = new User();
    user.id = 1;
    user.username = "jane_updated";
    user.email = "jane@example.com";
    
    await user.save();
    
    expect(mockAdapter.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET"),
        expect.any(Array)
    );
    
    const callArgs = (mockAdapter.query as any).mock.lastCall;
    const executedQuery = callArgs[0];
    
    expect(executedQuery).toContain("WHERE id =");
  });

  test("Model.delete() should DELETE", async () => {
    const user = new User();
    user.id = 5;
    
    await user.delete();
    
    expect(mockAdapter.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM users WHERE id = $1"),
        [5]
    );
  });
});
