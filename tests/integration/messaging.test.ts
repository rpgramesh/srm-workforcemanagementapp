import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { test, after, before } from "node:test";
import assert from "node:assert";
import { Client } from "pg";

const TEST_SIGNATURE = "[INTEGRATION_TEST_MSG]";

test("Messaging System Database Integration Test", async (t) => {
  // Dynamically import to ensure env variables are loaded
  const { messagingService } = await import("@/features/messaging/services/messaging-service");
  const { userRepository } = await import("@/features/users/repositories/supabase-user-repository");
  const { listDepartments } = await import("@/features/data/actions/reference-actions");

  /* eslint-disable @typescript-eslint/no-explicit-any */
  let ganga: any = null;
  let anmol: any = null;
  let ramesh: any = null;

  let gangaActor: any = null;
  let anmolActor: any = null;
  let _rameshActor: any = null;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  let directThreadId: string | null = null;
  let directMessageId: string | null = null;

  const cleanupMessages = async () => {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await pgClient.connect();
      // Delete any test messages containing the signature
      await pgClient.query("DELETE FROM public.messages WHERE body LIKE $1", [`%${TEST_SIGNATURE}%`]);
    } catch (err) {
      console.error("Cleanup messages failed:", err);
    } finally {
      await pgClient.end().catch(() => {});
    }
  };

  before(async () => {
    await cleanupMessages();

    // Look up the seeded users by their mobile numbers
    ganga = await userRepository.findByMobile("+61425071500"); // restaurant_admin
    anmol = await userRepository.findByMobile("+61435064041"); // employee
    ramesh = await userRepository.findByMobile("+61481904384"); // manager

    assert.ok(ganga, "Ganga should be seeded");
    assert.ok(anmol, "Anmol should be seeded");
    assert.ok(ramesh, "Ramesh should be seeded");

    gangaActor = { userId: ganga.id, role: ganga.role };
    anmolActor = { userId: anmol.id, role: anmol.role };
    _rameshActor = { userId: ramesh.id, role: ramesh.role };
  });

  after(async () => {
    await cleanupMessages();
  });

  await t.test("1. Send Direct Message - creates thread and persists message", async () => {
    const body = `Hello Anmol! This is a test message. ${TEST_SIGNATURE}`;
    const result = await messagingService.sendDirect(gangaActor, anmol.id, body);

    assert.ok(result.success, `Sending message should succeed: ${result.message}`);
    assert.ok(result.data, "Should return the message ID");
    directMessageId = result.data;

    // Load thread list for Ganga and find the direct thread
    const threads = await messagingService.listInbox(gangaActor);
    const thread = threads.find((th) => th.kind === "direct" && (th.participantIds ?? []).includes(anmol.id));
    assert.ok(thread, "Direct thread should exist in Ganga's inbox");
    directThreadId = thread.threadId;

    // Load direct thread messages and verify content
    const threadLoadResult = await messagingService.loadThread(gangaActor, directThreadId);
    assert.ok(threadLoadResult.success, "Should load thread successfully");
    assert.ok(threadLoadResult.data, "Should return thread data");

    const msg = threadLoadResult.data.messages.find((m) => m.id === directMessageId);
    assert.ok(msg, "Message should exist in thread messages");
    assert.strictEqual(msg.body, body);
    assert.strictEqual(msg.senderId, ganga.id);
  });

  await t.test("2. Mark Thread as Read - updates read receipts", async () => {
    if (!directThreadId || !directMessageId) {
      assert.fail("Skip read receipts test: thread or message not created");
    }

    // Mark the thread as read by Anmol (recipient) up to the sent message
    const readResult = await messagingService.markThreadRead(anmolActor, directThreadId, directMessageId);
    assert.ok(readResult.success, `Marking read should succeed: ${readResult.message}`);

    // Reload thread as Ganga to verify read receipt exists for Anmol
    const threadLoadResult = await messagingService.loadThread(gangaActor, directThreadId);
    assert.ok(threadLoadResult.success, "Should reload thread");
    const msg = threadLoadResult.data!.messages.find((m) => m.id === directMessageId);
    assert.ok(msg, "Message should exist");
    
    const readReceipt = (msg.readBy ?? []).find((r) => r.userId === anmol.id);
    assert.ok(readReceipt, "Read receipt for Anmol should exist on the message");
    assert.ok(readReceipt.readAt instanceof Date, "Read receipt should have readAt timestamp");
  });

  await t.test("3. Send Department Broadcast - allowed for managers & admins", async () => {
    const depts = await listDepartments();
    assert.ok(depts.length > 0, "Should have seeded departments");
    
    // Find Bar or FOH department
    const targetDept = depts[0]!;
    
    const body = `Important broadcast to all team members in ${targetDept.name}! ${TEST_SIGNATURE}`;
    
    // Test broadcast by Ganga (restaurant_admin - allowed)
    const resultGanga = await messagingService.broadcastToDepartment(gangaActor, targetDept.id, body);
    assert.ok(resultGanga.success, `Broadcast by Admin should succeed: ${resultGanga.message}`);
  });

  await t.test("4. Send Department Broadcast - rejected for employees", async () => {
    const depts = await listDepartments();
    const targetDept = depts[0]!;
    const body = `Employee broadcast attempt. ${TEST_SIGNATURE}`;

    // Test broadcast by Anmol (employee - forbidden)
    const resultAnmol = await messagingService.broadcastToDepartment(anmolActor, targetDept.id, body);
    assert.strictEqual(resultAnmol.success, false, "Broadcast by Employee should fail");
    assert.strictEqual(resultAnmol.message, "Only managers can send department broadcasts");
  });
});
