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

function readAndValidateInputs() {
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
        return null;
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

    return { slackHandles, alertDiv };
}

function generatePairs() {
    const inputs = readAndValidateInputs();
    if (!inputs) return;

    const { slackHandles } = inputs;
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
    const inputs = readAndValidateInputs();
    if (!inputs) return;

    const { slackHandles } = inputs;

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


