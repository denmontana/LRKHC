
const rankingBody = document.getElementById("ranking-body");
const statusText = document.getElementById("status");
const playerCount = document.getElementById("player-count");
const refreshButton = document.getElementById("refresh-button");
const lastUpdate = document.getElementById("last-update");

const API_URL = "https://lichess.org/api/user/";
const DELAY = 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPlayerPeak(username) {
    const url =
        `${API_URL}${encodeURIComponent(username)}/perf/racingKings`;

    try {
        const response = await fetch(url);

        if (response.status === 429) {
            return { username, rateLimited: true };
        }

        if (!response.ok) {
            return { username, error: true };
        }

        const data = await response.json();
        const peak = data?.stat?.highest?.int;

        if (typeof peak !== "number") {
            return { username, error: true };
        }

        return { username, peak };

    } catch (error) {
        console.error(`Error fetching ${username}:`, error);
        return { username, error: true };
    }
}

function renderRanking(players) {
    const validPlayers = players
        .filter(p => typeof p.peak === "number")
        .sort((a, b) =>
            b.peak - a.peak ||
            a.username.localeCompare(b.username)
        );

    const invalidPlayers = players.filter(p => p.error);

    rankingBody.innerHTML = "";

    validPlayers.forEach((player, index) => {
        const position = index + 1;
        const row = document.createElement("tr");

        if (position <= 3) {
            row.classList.add("top-three");
        }

        const rankCell = document.createElement("td");
        rankCell.className = "rank";
        rankCell.textContent = position;

        const nameCell = document.createElement("td");

        const link = document.createElement("a");
        link.className = "player-name";
        link.href =
            `https://lichess.org/@/${encodeURIComponent(player.username)}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = player.username;

        nameCell.appendChild(link);

        const ratingCell = document.createElement("td");
        ratingCell.className = "rating";

        // No thousands separators: 2345, not 2,345
        ratingCell.textContent = String(player.peak);

        row.append(rankCell, nameCell, ratingCell);
        rankingBody.appendChild(row);
    });

    invalidPlayers.forEach(player => {
        const row = document.createElement("tr");

        const rankCell = document.createElement("td");
        rankCell.className = "rank";
        rankCell.textContent = "—";

        const nameCell = document.createElement("td");
        const link = document.createElement("a");

        link.className = "player-name";
        link.href =
            `https://lichess.org/@/${encodeURIComponent(player.username)}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = player.username;

        nameCell.appendChild(link);

        const ratingCell = document.createElement("td");
        ratingCell.className = "rating error-text";
        ratingCell.textContent = "No data";

        row.append(rankCell, nameCell, ratingCell);
        rankingBody.appendChild(row);
    });

    playerCount.textContent =
        `${validPlayers.length} / ${players.length} players ranked`;
}

async function loadRanking() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";

    rankingBody.innerHTML = `
        <tr>
            <td colspan="3" class="loading">
                Fetching Lichess data...
            </td>
        </tr>
    `;

    statusText.textContent = "Loading players...";

    try {
        const response = await fetch("./data/players.json");

        if (!response.ok) {
            throw new Error("Could not load players.json");
        }

        const rawPlayers = await response.json();

        // Accept both simple usernames and objects with manual peaks.
        // Remove duplicate usernames automatically.
        const seen = new Set();

        const players = rawPlayers
            .map(player => {
                if (typeof player === "string") {
                    return {
                        username: player,
                        peak: null
                    };
                }

                return player;
            })
            .filter(player => {
                if (
                    !player ||
                    typeof player.username !== "string" ||
                    !player.username.trim()
                ) {
                    return false;
                }

                const key = player.username.toLowerCase().trim();

                if (seen.has(key)) {
                    return false;
                }

                seen.add(key);
                return true;
            });

        const results = [];
        let stoppedByLimit = false;

        playerCount.textContent = `${players.length} players`;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const username = player.username.trim();

            statusText.textContent =
                `Checking ${i + 1} of ${players.length}: ${username}`;

            let result;

            // Use manual peak if a valid number is provided.
            if (
                typeof player.peak === "number" &&
                Number.isFinite(player.peak)
            ) {
                result = {
                    username,
                    peak: player.peak
                };
            } else {
                result = await getPlayerPeak(username);
            }

            if (result.rateLimited) {
                stoppedByLimit = true;
                break;
            }

            results.push(result);

            if (i < players.length - 1) {
                await sleep(DELAY);
            }
        }

        renderRanking(results);

        if (stoppedByLimit) {
            statusText.textContent =
                "Lichess rate limit reached. Please try again later.";
        } else {
            statusText.textContent = "Classification updated";
        }

        lastUpdate.textContent =
            "Last updated: " +
            new Date().toLocaleString("en-GB");

    } catch (error) {
        console.error(error);

        statusText.textContent = "Error loading data";

        rankingBody.innerHTML = `
            <tr>
                <td colspan="3" class="loading error-text">
                    Could not load the classification.
                    Please check your connection and players.json.
                </td>
            </tr>
        `;

    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh";
    }
}

refreshButton.addEventListener("click", loadRanking);

loadRanking();
