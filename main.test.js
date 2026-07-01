function runTests() {
    console.log("Running tests...");

    const filterTestCases = [
        {
            input: {
                list: ["@a", "@b", "@c"],
                user: "@d",
                exclude: ["@b"],
            },
            expected: ["@a", "@c", "@d"],
        },
        {
            input: {
                list: ["@a", "@b", "@c", "@d"],
                user: "@e",
                exclude: ["@a", "@c"],
            },
            expected: ["@b", "@d", "@e"],
        },
    ];

    filterTestCases.forEach((testCase, index) => {
        const result = filterHandles(
            testCase.input.list,
            testCase.input.user,
            testCase.input.exclude,
        );
        const passed =
            JSON.stringify(result) ===
            JSON.stringify(testCase.expected);
        if (!passed) {
            alert(
                `Filter test case ${index + 1} FAILED:\nExpected: ${JSON.stringify(testCase.expected)}\nGot: ${JSON.stringify(result)}`,
            );
        }
    });

    const pairTestCases = [
        {
            input: ["@a", "@b", "@c"],
            expected: [["@a", "@b", "@c"]],
        },
        {
            input: ["@a", "@b", "@c", "@d"],
            expected: [
                ["@a", "@b"],
                ["@c", "@d"],
            ],
        },
        {
            input: ["@a", "@b", "@c", "@d", "@e"],
            expected: [
                ["@a", "@b"],
                ["@c", "@d", "@e"],
            ],
        },
    ];

    pairTestCases.forEach((testCase, index) => {
        const result = generatePairsFromList(testCase.input);
        const passed =
            JSON.stringify(result) ===
            JSON.stringify(testCase.expected);
        if (!passed) {
            alert(
                `Pair test case ${index + 1} FAILED:\nExpected: ${JSON.stringify(testCase.expected)}\nGot: ${JSON.stringify(result)}`,
            );
        }
    });

    // parseCompletedPairings tests
    const parsed1 = parseCompletedPairings("@alice & @bob\n@charlie & @dave");
    if (parsed1.size !== 2 || !parsed1.has("@alice & @bob") || !parsed1.has("@charlie & @dave")) {
        alert("parseCompletedPairings test 1 FAILED: basic parsing");
    }

    const parsed2 = parseCompletedPairings("@bob & @alice");
    if (!parsed2.has("@alice & @bob")) {
        alert("parseCompletedPairings test 2 FAILED: order normalization");
    }

    const parsed3 = parseCompletedPairings("  \n\n  @a & @b  \n  ");
    if (parsed3.size !== 1) {
        alert("parseCompletedPairings test 3 FAILED: whitespace handling");
    }

    // Numbered lines and round headers
    const parsed4 = parseCompletedPairings(
        "Runde 1 – Uke 2:\n1. @BL & @KJD\n2. @JT & @AR\nRunde 2:\n1. @Eva & @SS"
    );
    if (parsed4.size !== 3 || !parsed4.has("@BL & @KJD") || !parsed4.has("@AR & @JT") || !parsed4.has("@Eva & @SS")) {
        alert("parseCompletedPairings test 4 FAILED: numbered lines and headers");
    }

    // "og" separator
    const parsed5 = parseCompletedPairings("1. @TH og @BL");
    if (parsed5.size !== 1 || !parsed5.has("@BL & @TH")) {
        alert("parseCompletedPairings test 5 FAILED: 'og' separator");
    }

    // generateScheduleFromRemainingPairings tests
    // No completed pairings — should produce all pairs
    const sched1 = generateScheduleFromRemainingPairings(["@a", "@b", "@c", "@d"], new Set());
    const totalPairs1 = sched1.rounds.reduce((sum, r) => sum + r.length, 0);
    if (totalPairs1 !== 6) {
        alert(`Remaining schedule test 1 FAILED: expected 6 pairs, got ${totalPairs1}`);
    }

    // With some completed — should exclude them
    const completed = new Set(["@a & @b", "@c & @d"]);
    const sched2 = generateScheduleFromRemainingPairings(["@a", "@b", "@c", "@d"], completed);
    const totalPairs2 = sched2.rounds.reduce((sum, r) => sum + r.length, 0);
    if (totalPairs2 !== 4) {
        alert(`Remaining schedule test 2 FAILED: expected 4 pairs, got ${totalPairs2}`);
    }
    const allPairs2 = sched2.rounds.flat().map((p) => normalizePairKey(p[0], p[1]));
    if (allPairs2.includes("@a & @b") || allPairs2.includes("@c & @d")) {
        alert("Remaining schedule test 2 FAILED: completed pairs still present");
    }

    // New participant added — gets paired with everyone
    const sched3 = generateScheduleFromRemainingPairings(
        ["@a", "@b", "@c", "@e"],
        new Set(["@a & @b", "@a & @c", "@b & @c"]),
    );
    const allPairs3 = sched3.rounds.flat().map((p) => normalizePairKey(p[0], p[1]));
    if (allPairs3.length !== 3 || !allPairs3.includes("@a & @e") || !allPairs3.includes("@b & @e") || !allPairs3.includes("@c & @e")) {
        alert("Remaining schedule test 3 FAILED: new participant should be paired with all existing");
    }

    // All pairings completed — empty schedule
    const sched4 = generateScheduleFromRemainingPairings(
        ["@a", "@b"],
        new Set(["@a & @b"]),
    );
    if (sched4.rounds.length !== 0) {
        alert("Remaining schedule test 4 FAILED: should be empty when all done");
    }

    // No participant appears twice in same round
    const sched5 = generateScheduleFromRemainingPairings(["@a", "@b", "@c", "@d", "@e"], new Set());
    for (let ri = 0; ri < sched5.rounds.length; ri++) {
        const seen = new Set();
        for (const pair of sched5.rounds[ri]) {
            for (const p of pair) {
                if (seen.has(p)) {
                    alert(`Remaining schedule test 5 FAILED: ${p} appears twice in round ${ri + 1}`);
                }
                seen.add(p);
            }
        }
    }

    // Person left — completed pairings with them exist but no new pairs generated
    const sched6 = generateScheduleFromRemainingPairings(
        ["@a", "@b", "@c"],
        new Set(["@a & @d", "@b & @d"]),
    );
    const allPairs6 = sched6.rounds.flat().map((p) => normalizePairKey(p[0], p[1]));
    if (allPairs6.some((k) => k.includes("@d"))) {
        alert("Remaining schedule test 6 FAILED: departed person should not get new pairs");
    }
    if (!allPairs6.includes("@a & @b") || !allPairs6.includes("@a & @c") || !allPairs6.includes("@b & @c")) {
        alert("Remaining schedule test 6 FAILED: remaining active pairs missing");
    }

    // parseExcludeHandles with comma-separated input
    const excl1 = parseExcludeHandles("@a, @b, @c");
    if (excl1.length !== 3 || !excl1.includes("@a") || !excl1.includes("@b") || !excl1.includes("@c")) {
        alert("parseExcludeHandles test 1 FAILED: comma-separated");
    }

    // parseExcludeHandles with newline-separated input
    const excl2 = parseExcludeHandles("@a\n@b\n@c");
    if (excl2.length !== 3 || !excl2.includes("@a") || !excl2.includes("@b") || !excl2.includes("@c")) {
        alert("parseExcludeHandles test 2 FAILED: newline-separated");
    }

    // parseExcludeHandles with mixed input
    const excl3 = parseExcludeHandles("@a, @b\n@c");
    if (excl3.length !== 3) {
        alert("parseExcludeHandles test 3 FAILED: mixed separators");
    }

    console.log("Running tests... done.");
}