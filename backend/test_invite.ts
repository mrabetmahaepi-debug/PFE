/**
 * Test script to debug the invite-admin endpoint
 * Usage: npx ts-node test_invite.ts
 */

async function main() {
  // 1. Login as SuperAdmin first
  console.log("=== Step 1: Login as SuperAdmin ===");
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superadmin@gp.com", password: "superadmin123" })
  });
  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status);
  console.log("Login response:", JSON.stringify(loginData, null, 2));

  if (!loginData.token) {
    console.error("❌ Could not get token. Aborting.");
    return;
  }
  const token = loginData.token;

  // 2. Get enterprises to find a valid id_entreprise
  console.log("\n=== Step 2: Get Enterprises ===");
  const entRes = await fetch("http://localhost:5000/api/entreprises", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const entData = await entRes.json();
  console.log("Enterprises status:", entRes.status);
  const enterprises = entData?.data?.items || entData?.data || [];
  console.log("Enterprises found:", enterprises.length);
  if (enterprises.length > 0) {
    console.log("First enterprise:", JSON.stringify(enterprises[0], null, 2));
  }

  const targetEntId = enterprises.length > 0 ? enterprises[0].id_entreprise : 1;

  // 3. Try the invite-admin endpoint
  const testPayload = {
    nom: "TestAdmin",
    prenom: "Debug",
    email: `testadmin_${Date.now()}@debug.com`,
    mot_de_passe: "password123",
    id_entreprise: targetEntId
  };
  
  console.log("\n=== Step 3: Invite Admin ===");
  console.log("Payload:", JSON.stringify(testPayload, null, 2));
  console.log("URL: POST http://localhost:5000/api/entreprises/invite-admin");
  
  const inviteRes = await fetch("http://localhost:5000/api/entreprises/invite-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(testPayload)
  });

  const inviteData = await inviteRes.json();
  console.log("\n=== RESULT ===");
  console.log("Status code:", inviteRes.status);
  console.log("Response body:", JSON.stringify(inviteData, null, 2));
  
  if (inviteRes.status >= 400) {
    console.log("\n❌ INVITATION FAILED");
    console.log("Message:", inviteData.message);
    console.log("Error:", inviteData.error);
    console.log("Details:", inviteData.details);
    console.log("Errors:", JSON.stringify(inviteData.errors, null, 2));
  } else {
    console.log("\n✅ INVITATION SUCCESS");
  }
}

main().catch(err => {
  console.error("Script error:", err);
});
