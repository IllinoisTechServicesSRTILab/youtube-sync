//#region Creating variables
    // username = the user's username
    // myVideo = the video player object
    // socket = the websocket object
    // updatingPlayer - used to prevent infinite loops
    // role - the current user's role as a host or a guest
    var username, myVideo, socket, updatingPlayer, role, url, initialTimestamp, initialPaused;
    const HOST_ROLE = 0;
    const GUEST_ROLE = 1;
//#endregion

// Called on page load
window.onload = function() {
    username = getParams()["username"];
    role = getParams()["role"];

    // Gets a pointer to the video.js object
    myVideo = videojs('my-video');

    // Lets the user press enter to send a chat message
    document.getElementById("chat-type").onkeypress = function(e) {
        if (e.which == 13) {
            sendChatMessage();
        }
    }

    // Connects to websockets
    socket = io.connect("http://127.0.0.1:5000");

    // Reports disconnection to the server before the tab is fully closed
    window.addEventListener("beforeunload", ReportDisconnection);
    window.addEventListener("unload", ReportDisconnection);

    // Shows the loading message
    document.getElementById("session-loading").style.display = "initial";
    document.getElementById("session-loading-indicator").style.display = "";

    setTimeout(function() {
        if (document.getElementById("session-loading").style.display == "initial") {
            document.getElementById("session-loading").style.color = "red";
            document.getElementById("session-loading").innerHTML = "<br><br>An error occured. Please try again later.<br><br>";
            document.getElementById("return_after_error_button").style.display = "initial";
            document.getElementById("session-loading-indicator").style.display = "none";
        }
    }, 10000);

    // If the user is a host
    if (role == HOST_ROLE) {
        url = getParams()["url"];
        initialTimestamp = getParams()["PlayerTimestamp"];
        initialPaused = (getParams()["Paused"] == "true");

        document.getElementById("session-loading").innerHTML = "<br><br>Creating session, please wait...<br><br>";

        // Handle receiving messages from the server
        socket.addEventListener('message', HostMessageHandler);

        // Tells the webserver the host's username
        socket.send({
            "type": "join",
            "role": HOST_ROLE,
            "name": username,
            "url": url
        });

        SetData();
    }
    // If the user is a guest
    else {
        document.getElementById("session-loading").innerHTML = "<br><br>Joining session, please wait...<br><br>";

        // Sends a join request to the server
        socket.send({"type": "join", "role": GUEST_ROLE, "name": username});

        // Handles recieving messages from the server
        socket.addEventListener('message', GuestMessageHandler);
    }
}

// Reports disconnection to the server before the tab is fully closed
function ReportDisconnection() {
    if (role == HOST_ROLE)
        socket.send({"type":"leave", "role": HOST_ROLE, "name": username});
    else
        socket.send({"type":"leave", "role": GUEST_ROLE, "name": username});
}

// Called by the guest and host; adds the given message to the chat
function UpdateChat(event) {
    // Emblem, used to make any messages sent by the host be bolded
    var emblem = "";
    if (event["role"] == HOST_ROLE) {
        emblem = " style='font-weight: bold;'"
    }

    // Adds the message to the chat box
    document.getElementById("chat-box").innerHTML += ("<br><option" + emblem + " class='username-object'>[" + event["username"] + "] " + event["message"] + "</option>");

    // Scrolls to the bottom of the chat
    document.getElementById("chat-box").scrollTop = document.getElementById("chat-box").scrollHeight;
}

// Updates the user list
function UpdateUserData(event) {
    var userData = event["data"];

    // Removes all shown users
    document.getElementById("users-list-child").innerHTML = "";

    for (let sid in userData) {
        var host_style = "";
        var suffix = "";

        if (userData[sid]["role"] == HOST_ROLE) {
            host_style = " style='font-weight: bold;'";
            suffix += " (Host)";
        }

        if (userData[sid]["username"] == username) {
            suffix += " (You)";
        }

        document.getElementById("users-list-child").innerHTML += ("<br><option" + host_style + " class='username-object' value='" + userData[sid]["username"] + "'> - " + userData[sid]["username"] + suffix + "</option>");
    }
}

// Sends data to the server to be sent to guest users
function SetData() {
    // Creates a JSON string with the data
    var dataToSet = JSON.stringify({
        PlayerTimestamp: myVideo.currentTime(),
        Paused: myVideo.paused()
    });

    socket.send({"type":"host_data","action":"set","data":dataToSet});
}

// Sends a chat message
function sendChatMessage() {
    socket.send({'type':'chat', 'username': username, 'message': document.getElementById('chat-type').value, 'role': role});
    document.getElementById('chat-type').value = '';
}

// Updates the video player with the specified data
function UpdatePlayer(PlayerData) {
    updatingPlayer = true;
    setTimeout(function() {updatingPlayer = false}, 1000);
    myVideo.currentTime(PlayerData["PlayerTimestamp"]);

    if (PlayerData["Paused"] == true) {
        myVideo.pause();
    } else {
        myVideo.play();
    }
}

function KickUser() {
    var selectedUser = document.getElementById('users-list-child').options[document.getElementById('users-list-child').selectedIndex].value;

    if (selectedUser != username) {
        socket.send({
            'type': 'kick_user',
            'user': selectedUser
        });
    }
    else {
        alert("Error: You cannot kick yourself");
    }
}

function PromoteToHost() {
    var selectedUser = document.getElementById('users-list-child').options[document.getElementById('users-list-child').selectedIndex].value;

    if (selectedUser != username) {
        socket.send({
            'type': 'promote_user',
            'user': selectedUser,
            'host_username': username,
            'video_state': {
                'PlayerTimestamp': myVideo.currentTime(),
                'Paused': myVideo.paused()
            }
        });
    }
    else {
        alert("Error: You cannot promote yourself to host");
    }
}

function ChangeVideoURL() {
    var newUrl = document.getElementById("new-url-type").value;
    myVideo.src({type: 'video/youtube', src: newUrl});
    socket.send({
        'type': 'change_video_url',
        'url': newUrl
    });
}

function RemoveChatMessage() {
    if (confirm("Are you sure you want to remove the selected chat message?")) {
        socket.send({
            'type': 'remove_chat_message',
            'message_index': document.getElementById('chat-box').selectedIndex,
            'message_content': document.getElementById('chat-box')[document.getElementById('chat-box').selectedIndex].innerHTML
        });
    }
}