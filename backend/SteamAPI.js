import axios from "axios";

export async function getOwnedGames(steamID) {
  const key = process.env.STEAM_API_KEY;

  try {
    const { data } = await axios.get(
      "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
      {
        params: {
          key,
          steamid: steamID,
          include_appinfo: false, // we only need appid
          include_played_free_games: true,
        },
      }
    );

    // return up to the first 100 raw entries
    return (data.response?.games || []).slice(0, 100);
  } catch (err) {
    console.error("Error fetching owned games:", err.message);
    throw err;
  }
}

export async function getGameData(appid) {
  try {
    const { data } = await axios.get(
      "https://store.steampowered.com/api/appdetails",
      {
        params: { appids: appid },
      }
    );

    const game = data[appid];
    if (!game.success || !game.data) return null;

    const categories = game.data.categories
      ? game.data.categories.map((c) => c.description).join(", ")
      : "Uncategorized";

    return {
      appid,
      title: game.data.name || "Unknown",
      imageUrl: game.data.header_image || "",
      category: categories,
    };
  } catch (error) {
    console.error("Steam API error:   AppID:", appid, error);
    return null;
  }
}

export async function getPlayerSummary(steamID) {
  const key = process.env.STEAM_API_KEY;
  try {
    const { data } = await axios.get(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
      {
        params: {
          key,
          steamids: steamID,
        },
      }
    );
    const players = data.response?.players;
    if (!players || !players.length) return null;

    // pick the first (and only) player object - will need future handling for multiple
    const { personaname, avatar, avatarfull, profileurl } = players[0];

    return { personaname, avatar, avatarfull, profileurl };
  } catch (error) {
    console.error("Steam API error (getPlayerSummary):", error.message);
    return null;
  }
}
