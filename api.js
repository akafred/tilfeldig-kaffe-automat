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
            })
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
        if (error.message.includes('fetch')) {
            showAlert("Kan ikke koble til lokal server. Sørg for at du har kjørt 'npm start' og gå til http://localhost:3000/api.html");
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

function copyMembersToClipboard() {
    const memberList = document.getElementById("memberList");
    memberList.select();
    document.execCommand("copy");
    showSuccess("Medlemsliste kopiert til utklippstavle!");
}

function goToMainPageWithMembers() {
    const memberList = document.getElementById("memberList").value;
    localStorage.setItem("apiMemberList", memberList);
    window.location.href = "index.html";
}