
import { describe, expect, test, mock } from "bun:test";
import { PostgresQueryBuilder } from "../../src/postgres/PostgresQueryBuilder";
import type { DBAdapter } from "../../src/core/DBAdapter";

// Mock Adapter
const mockAdapter: DBAdapter = {
  connect: mock(async () => {}),
  close: mock(async () => {}),
  query: mock(async (query: string, params?: any[]) => {
    return []; // Return empty array by default
  }),
  createQueryBuilder: mock((table: string) => new PostgresQueryBuilder(mockAdapter, table) as any),
};

describe("PostgresQueryBuilder Security & Logic", () => {
  
  test("WHERE clause should use parameterized queries", async () => {
    const qb = new PostgresQueryBuilder(mockAdapter, "users");
    
    // Simulate a malicious input
    const maliciousInput = "' OR '1'='1";
    
    await qb.where("username", "=", maliciousInput).get();
    
    // Verify that the adapter was called with parameter, NOT string concatenation
    expect(mockAdapter.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE username = $1"),
      expect.arrayContaining([maliciousInput])
    );
    
    // Check that the malicious input is NOT in the query string itself
    const callArgs = (mockAdapter.query as any).mock.lastCall;
    const executedQuery = callArgs[0];
    expect(executedQuery).not.toContain(maliciousInput);
  });

  test("INSERT should use placeholders", async () => {
    const qb = new PostgresQueryBuilder(mockAdapter, "users");
    const data = { username: "admin", password: "password123" };
    
    await qb.insert(data);
    
    expect(mockAdapter.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users (username, password) VALUES ($1, $2)"),
      ["admin", "password123"]
    );
  });

  test("UPDATE with WHERE should handle parameter re-indexing correctly", async () => {
    const qb = new PostgresQueryBuilder(mockAdapter, "users");
    
    // Add a WHERE clause first (param $1)
    qb.where("id", "=", 123);
    
    // Then perform UPDATE (should start params from 1 for update values, and shift where params)
    await qb.update({ username: "new_name" });
    
    // Logic in PostgresQueryBuilder.ts:
    // Updates params come first: username = $1
    // WHERE params come after and are re-indexed: id = $2
    
    const callArgs = (mockAdapter.query as any).mock.lastCall;
    const executedQuery = callArgs[0];
    const executedParams = callArgs[1];
    
    expect(executedQuery).toContain("UPDATE users SET username = $1 WHERE id = $2");
    expect(executedParams).toEqual(["new_name", 123]);
  });

  test("Should handle multiple WHERE conditions", async () => {
    const qb = new PostgresQueryBuilder(mockAdapter, "products");
    
    await qb
      .where("category", "=", "electronics")
      .where("price", ">", 100)
      .get();
      
    expect(mockAdapter.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE category = $1 AND price > $2"),
      ["electronics", 100]
    );
  });
});

describe("Potential Injection Vectors (Developer Awareness)", () => {
  test("Column name injection in WHERE (Known Limitation)", async () => {
    // NOTE: This test demonstrates a vulnerability if developers pass unsanitized input as column names.
    // The ORM currently assumes column names are safe.
    const qb = new PostgresQueryBuilder(mockAdapter, "users");
    const maliciousColumn = "id; DROP TABLE users; --";
    
    await qb.where(maliciousColumn, "=", 1).get();
    
    const callArgs = (mockAdapter.query as any).mock.lastCall;
    const executedQuery = callArgs[0];
    
    // Ideally, this should be quoted or validated, but currently it's interpolated directly.
    // We assert behavior here to document it.
    expect(executedQuery).toContain(`${maliciousColumn} = $1`);
  });
  
  test("Operator injection in WHERE (Known Limitation)", async () => {
     const qb = new PostgresQueryBuilder(mockAdapter, "users");
     const maliciousOp = "IS NOT NULL; --";
     
     await qb.where("id", maliciousOp, 1).get();
     
     const callArgs = (mockAdapter.query as any).mock.lastCall;
     const executedQuery = callArgs[0];
     
     expect(executedQuery).toContain(`id ${maliciousOp} $1`);
  });
});
