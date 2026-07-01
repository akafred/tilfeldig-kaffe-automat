document.addEventListener("DOMContentLoaded", () => {
    const userHandleInput = document.getElementById("userHandle");
    userHandleInput.value =
        localStorage.getItem("userHandle") || "";

    const excludeHandlesInput =
        document.getElementById("excludeHandles");
    excludeHandlesInput.value =
        localStorage.getItem("excludeHandles") || "";

    const apiMemberList = localStorage.getItem("apiMemberList");
    if (apiMemberList) {
        document.getElementById("handleList").value = apiMemberList;
        localStorage.removeItem("apiMemberList");
    }

    runTests();
});

function generatePairs() {
    let handleList = document.getElementById("handleList").value;
    handleList = handleList
        .replace(/Users here:|\.\.\. and you!/g, "")
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e);
    const userHandle = document
        .getElementById("userHandle")
        .value.trim();
    const excludeHandlesInput =
        document.getElementById("excludeHandles").value;
    const excludeHandles = parseExcludeHandles(excludeHandlesInput);
    const alertDiv = document.getElementById("alert");

    if (!userHandle) {
        alertDiv.innerHTML =
            "Vennligst legg til ditt eget Slack-handle.";
        alertDiv.style.display = "block";
        return;
    } else {
        alertDiv.style.display = "none";
    }

    localStorage.setItem("userHandle", userHandle);
    localStorage.setItem("excludeHandles", excludeHandlesInput);

    const slackHandles = filterHandles(
        handleList,
        userHandle,
        excludeHandles,
    );
    shuffleArray(slackHandles);

    const pairs = generatePairsFromList(slackHandles);

    let resultText = "";
    pairs.forEach((pair, index) => {
        resultText += `${index + 1}. ${pair.join(" & ")}<br>`;
    });

    document.getElementById("result").innerHTML = resultText;
    document.getElementById("result").style.display = "block";
    document.getElementById("copyButton").style.display = "block";
}

function filterHandles(handleList, userHandle, excludeHandles) {
    return handleList
        .filter(
            (handle) =>
                !excludeHandles.includes(handle) &&
                handle !== userHandle,
        )
        .concat(userHandle);
}

function generatePairsFromList(list) {
    const pairs = [];
    for (let i = 0; i < list.length; i += 2) {
        if (i + 3 === list.length) {
            pairs.push([list[i], list[i + 1], list[i + 2]]);
            break;
        } else if (i + 1 < list.length) {
            pairs.push([list[i], list[i + 1]]);
        }
    }
    return pairs;
}

function parseExcludeHandles(input) {
    return input
        .split(/[\n,]/)
        .map((e) => e.trim())
        .filter((e) => e);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

async function copyToClipboard() {
    const resultDiv = document.getElementById("result");
    const alertDiv = document.getElementById("alert");
    
    try {
        await navigator.clipboard.writeText(resultDiv.innerText);
        alertDiv.innerHTML =
            "Resultatet er kopiert til utklippstavlen!";
        alertDiv.style.display = "block";
    } catch (err) {
        alertDiv.innerHTML =
            "Kunne ikke kopiere til utklippstavlen.";
        alertDiv.style.display = "block";
    }
}

function generateCompleteSchedule() {
    let handleList = document.getElementById("handleList").value;
    handleList = handleList
        .replace(/Users here:|\.\.\. and you!/g, "")
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e);
    const userHandle = document
        .getElementById("userHandle")
        .value.trim();
    const excludeHandlesInput =
        document.getElementById("excludeHandles").value;
    const excludeHandles = parseExcludeHandles(excludeHandlesInput);
    const alertDiv = document.getElementById("alert");

    if (!userHandle) {
        alertDiv.innerHTML =
            "Vennligst legg til ditt eget Slack-handle.";
        alertDiv.style.display = "block";
        return;
    } else {
        alertDiv.style.display = "none";
    }

    localStorage.setItem("userHandle", userHandle);
    localStorage.setItem("excludeHandles", excludeHandlesInput);

    const slackHandles = filterHandles(
        handleList,
        userHandle,
        excludeHandles,
    );

    const completedInput = document.getElementById("completedPairings");
    const completedPairings = completedInput
        ? parseCompletedPairings(completedInput.value)
        : new Set();

    const schedule = generateScheduleFromRemainingPairings(
        slackHandles,
        completedPairings,
    );

    let resultText = "";
    schedule.rounds.forEach((round, index) => {
        resultText += `<strong>Runde ${index + 1}:</strong><br>`;
        round.forEach((pair, pairIndex) => {
            resultText += `${pairIndex + 1}. ${pair.join(" & ")}<br>`;
        });
        if (schedule.skipped[index]) {
            resultText += `<em>Står over: ${schedule.skipped[index]}</em><br>`;
        }
        resultText += "<br>";
    });

    if (schedule.rounds.length === 0) {
        resultText = "<em>Alle paringer er allerede gjennomført!</em>";
    }

    // Build round lookup for planned pairings
    const plannedRounds = {};
    schedule.rounds.forEach((round, index) => {
        round.forEach((pair) => {
            plannedRounds[normalizePairKey(pair[0], pair[1])] = index + 1;
        });
    });

    resultText += renderPairingMatrix(slackHandles, completedPairings, plannedRounds);

    document.getElementById("result").innerHTML = resultText;
    document.getElementById("result").style.display = "block";
    document.getElementById("copyButton").style.display = "block";
}

function renderPairingMatrix(participants, completedPairings, plannedRounds) {
    // Collect all people from completed pairings (includes people who left)
    const allPeople = new Set(participants);
    completedPairings.forEach((key) => {
        key.split(" & ").forEach((p) => allPeople.add(p));
    });
    const sorted = [...allPeople].sort();
    const n = sorted.length;
    const activeSet = new Set(participants);

    let html = '<h3>Paringsmatrise</h3>';
    html += '<div style="overflow-x:auto">';
    html += '<table class="pairing-matrix"><tbody>';

    for (let i = 0; i < n; i++) {
        const rowLabel = sorted[i].replace("@", "");
        const rowClass = activeSet.has(sorted[i]) ? '' : ' class="pair-inactive"';
        html += `<tr><th${rowClass}>${rowLabel}</th>`;
        for (let j = 0; j < n; j++) {
            if (j === i) {
                html += '<td class="pair-diag"></td>';
            } else {
                const key = normalizePairKey(sorted[i], sorted[j]);
                if (completedPairings.has(key)) {
                    html += '<td class="pair-done" title="Gjennomført">&#10003;</td>';
                } else if (plannedRounds[key]) {
                    html += `<td class="pair-planned" title="Runde ${plannedRounds[key]}">${plannedRounds[key]}</td>`;
                } else {
                    html += '<td class="pair-none">-</td>';
                }
            }
        }
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    html += '<p><small>';
    html += '<span class="pair-done" style="padding:2px 6px">&#10003;</span> = gjennomført &nbsp; ';
    html += '<span class="pair-planned" style="padding:2px 6px">N</span> = planlagt runde &nbsp; ';
    html += '<span class="pair-none" style="padding:2px 6px">-</span> = ikke aktuell';
    html += '</small></p>';

    return html;
}

function normalizePairKey(a, b) {
    return [a, b].sort().join(" & ");
}

function parseCompletedPairings(input) {
    const pairs = new Set();
    input
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)
        .forEach((line) => {
            // Strip leading numbering like "1. " or "12. "
            const stripped = line.replace(/^\d+\.\s*/, "");
            // Split on " & " or " og "
            const parts = stripped.split(/\s+(?:&|og)\s+/).map((p) => p.trim()).filter((p) => p);
            if (parts.length === 2 && parts[0].startsWith("@") && parts[1].startsWith("@")) {
                pairs.add(normalizePairKey(parts[0], parts[1]));
            }
        });
    return pairs;
}

function generateScheduleFromRemainingPairings(participants, completedPairings) {
    const n = participants.length;
    if (n < 2) return { rounds: [], skipped: [] };

    const remaining = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const key = normalizePairKey(participants[i], participants[j]);
            if (!completedPairings.has(key)) {
                remaining.push([participants[i], participants[j]]);
            }
        }
    }

    shuffleArray(remaining);

    const rounds = [];
    const skipped = [];

    while (remaining.length > 0) {
        const round = [];
        const usedInRound = new Set();
        const usedIndices = new Set();

        for (let i = 0; i < remaining.length; i++) {
            const [a, b] = remaining[i];
            if (!usedInRound.has(a) && !usedInRound.has(b)) {
                round.push([a, b]);
                usedInRound.add(a);
                usedInRound.add(b);
                usedIndices.add(i);
            }
        }

        for (let i = remaining.length - 1; i >= 0; i--) {
            if (usedIndices.has(i)) {
                remaining.splice(i, 1);
            }
        }

        const allInRound = new Set(round.flat());
        const sitting = participants.filter((p) => !allInRound.has(p));
        rounds.push(round);
        skipped.push(sitting.length > 0 ? sitting.join(", ") : null);
    }

    return { rounds, skipped };
}

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
}