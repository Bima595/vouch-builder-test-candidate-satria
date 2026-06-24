require("dotenv").config();

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function runVouchTest() {
  console.log("==========================================");
  console.log("VOUCH NIGHT-SHIFT HANDOVER ACCEPTANCE TEST");
  console.log("==========================================\n");

  const requestBody = {
    hotelId: "lumen-sg",
    shiftDate: "2026-05-27"
  };

  try {
    console.log("Generating handover...");
    console.log(JSON.stringify(requestBody, null, 2));
    console.log("");

    const response = await fetch(`${BASE_URL}/handover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const handover = await response.json();

    console.log("✅ Request succeeded");
    console.log("");

    console.log("=== HANDOVER SUMMARY ===");

    if (handover.meta) {
      console.log(JSON.stringify(handover.meta, null, 2));
    }

    console.log("");

    const validated =
      handover.validated ||
      handover.handover?.statements ||
      [];

    const rejected =
      handover.rejected ||
      [];

    const flags =
      handover.flags ||
      handover.handover?.flags ||
      [];

    console.log(`Validated statements : ${validated.length}`);
    console.log(`Rejected statements  : ${rejected.length}`);
    console.log(`Flags                : ${flags.length}`);

    console.log("");
    console.log("=== ACTION ITEMS ===");

    validated.forEach((item, index) => {
      console.log(`\n[${index + 1}]`);

      if (item.title) {
        console.log(`Title      : ${item.title}`);
      }

      if (item.summary) {
        console.log(`Summary    : ${item.summary}`);
      }

      if (item.category) {
        console.log(`Category   : ${item.category}`);
      }

      if (item.status) {
        console.log(`Status     : ${item.status}`);
      }

      if (item.roomNumber || item.room) {
        console.log(
          `Room       : ${item.roomNumber || item.room}`
        );
      }

      if (item.sourceEventIds) {
        console.log(
          `Grounded By: ${item.sourceEventIds.join(", ")}`
        );
      }
    });

    console.log("");
    console.log("=== FLAGS ===");

    if (flags.length === 0) {
      console.log("No flags raised");
    } else {
      flags.forEach((flag, index) => {
        console.log(`\n[${index + 1}]`);

        console.log(
          `Type : ${flag.flagType || flag.type}`
        );

        console.log(
          `Info : ${flag.description || flag.message}`
        );

        if (flag.sourceEventIds) {
          console.log(
            `Source Events : ${flag.sourceEventIds.join(", ")}`
          );
        }
      });
    }

    console.log("");
    console.log("=== GROUNDING CHECK ===");

    const ungrounded = validated.filter(
      (item) =>
        !item.sourceEventIds ||
        item.sourceEventIds.length === 0
    );

    if (ungrounded.length > 0) {
      console.log(
        `❌ Found ${ungrounded.length} ungrounded statements`
      );
      process.exit(1);
    }

    console.log("✅ All statements have source references");

    console.log("");
    console.log("=== RESULT ===");
    console.log("✅ Acceptance test passed");

  } catch (error) {
    console.error("");
    console.error("❌ Acceptance test failed");
    console.error(error.message);
    process.exit(1);
  }
}

runVouchTest();