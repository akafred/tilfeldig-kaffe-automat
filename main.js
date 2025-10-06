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
        .split("\n")
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

    const schedule = generateRoundRobinSchedule(slackHandles);

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

    document.getElementById("result").innerHTML = resultText;
    document.getElementById("result").style.display = "block";
    document.getElementById("copyButton").style.display = "block";
}

function generateRoundRobinSchedule(participants) {
    const n = participants.length;
    if (n < 2) return { rounds: [], skipped: [] };

    let players = [...participants];
    const hasOddNumber = n % 2 === 1;

    if (hasOddNumber) {
        players.push("BYE");
    }

    const rounds = [];
    const skipped = [];
    const numRounds = players.length - 1;

    for (let round = 0; round < numRounds; round++) {
        const pairs = [];
        let skippedPlayer = null;

        for (let i = 0; i < players.length / 2; i++) {
            const player1 = players[i];
            const player2 = players[players.length - 1 - i];

            if (player1 === "BYE") {
                skippedPlayer = player2;
            } else if (player2 === "BYE") {
                skippedPlayer = player1;
            } else {
                pairs.push([player1, player2]);
            }
        }

        if (pairs.length > 0) {
            rounds.push(pairs);
            skipped.push(skippedPlayer);
        }

        const fixed = players[0];
        const rotating = players.slice(1);
        const last = rotating.pop();
        rotating.unshift(last);
        players = [fixed, ...rotating];
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

    const roundRobinTestCases = [
        {
            input: ["@a", "@b", "@c", "@d"],
            expectedRounds: 3,
            expectedTotalPairs: 6
        },
        {
            input: ["@a", "@b", "@c"],
            expectedRounds: 3,
            expectedTotalPairs: 3
        },
        {
            input: ["@a", "@b", "@c", "@d", "@e"],
            expectedRounds: 5,
            expectedTotalPairs: 10
        }
    ];

    roundRobinTestCases.forEach((testCase, index) => {
        const schedule = generateRoundRobinSchedule(testCase.input);
        const totalPairs = schedule.rounds.reduce((sum, round) => sum + round.length, 0);

        if (schedule.rounds.length !== testCase.expectedRounds || totalPairs !== testCase.expectedTotalPairs) {
            alert(
                `Round robin test case ${index + 1} FAILED:\nExpected ${testCase.expectedRounds} rounds with ${testCase.expectedTotalPairs} total pairs\nGot ${schedule.rounds.length} rounds with ${totalPairs} total pairs`
            );
        }
    });
}