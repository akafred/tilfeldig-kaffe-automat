document.addEventListener("DOMContentLoaded", () => {
    const tokenInput = document.getElementById("apiToken");
    const channelInput = document.getElementById("channelId");
    
    tokenInput.value = localStorage.getItem("slackToken") || "";
    channelInput.value = localStorage.getItem("channelId") || "";
});

async function fetchChannelMembers() {
    const token = document.getElementById("apiToken").value.trim();
    const channelInput = document.getElementById("channelId").value.trim();
    const alertDiv = document.getElementById("alert");
    const successDiv = document.getElementById("success");
    const fetchButton = document.getElementById("fetchButton");
    
    alertDiv.style.display = "none";
    successDiv.style.display = "none";
    
    if (!token || !channelInput) {
        showAlert("Vennligst fyll inn både token og kanal-ID/navn.");
        return;
    }
    
    fetchButton.disabled = true;
    fetchButton.textContent = "Henter medlemmer...";
    
    localStorage.setItem("slackToken", token);
    localStorage.setItem("channelId", channelInput);
    
    try {
        const response = await fetch('/api/slack/channel-members', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: token,
                channelId: channelInput
            }),
            signal: AbortSignal.timeout(30000)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ukjent feil');
        }
        
        document.getElementById("memberList").value = data.members.join(", ");
        document.getElementById("memberResult").style.display = "block";
        document.getElementById("serverAlert").style.display = "none";
        
        showSuccess(`Hentet ${data.members.length} medlemmer fra kanalen.`);
        
    } catch (error) {
        if (error.name === 'TimeoutError') {
            showAlert("Forespørselen tok for lang tid. Prøv igjen eller sjekk nettverksforbindelsen.");
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            showAlert("Kan ikke koble til lokal server. Sørg for at du har kjørt 'npm start' og gå til http://localhost:3000/api.html");
        } else if (error.message.includes('invalid_auth')) {
            showAlert("Ugyldig Slack token. Sjekk at tokenet er riktig og har tilgang til kanalen.");
        } else if (error.message.includes('channel_not_found')) {
            showAlert("Fant ikke kanalen. Sjekk at kanal-ID eller navn er riktig.");
        } else {
            showAlert(`Feil: ${error.message}`);
        }
    } finally {
        fetchButton.disabled = false;
        fetchButton.textContent = "Hent medlemmer fra Slack";
    }
}


function showAlert(message) {
    const alertDiv = document.getElementById("alert");
    alertDiv.innerHTML = message;
    alertDiv.style.display = "block";
}

function showSuccess(message) {
    const successDiv = document.getElementById("success");
    successDiv.innerHTML = message;
    successDiv.style.display = "block";
}

async function copyMembersToClipboard() {
    const memberList = document.getElementById("memberList");
    
    try {
        await navigator.clipboard.writeText(memberList.value);
        showSuccess("Medlemsliste kopiert til utklippstavle!");
    } catch (err) {
        showAlert("Kunne ikke kopiere til utklippstavlen.");
    }
}

function goToMainPageWithMembers() {
    const memberList = document.getElementById("memberList").value;
    localStorage.setItem("apiMemberList", memberList);
    window.location.href = "index.html";
}