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
          include_appinfo: false,
          include_played_free_games: true,
        },
      }
    );

    const games = data.response?.games || [];
    // only fetch details for the first 100 games to avoid rate-limiting
    const toFetch = games.slice(0, 100);
    const gameDetails = await Promise.all(
      toFetch.map(async (g) => {
        try {
          const appData = await getGameData(g.appid);
          return (
            appData || {
              appid: g.appid,
              title: "Unknown",
              image_url: " ",
              category: " ",
            }
          );
        } catch (err) {
          console.warn(`Failed to fetch data for appid ${g.appid}`);
          return (
            appData || {
              appid: g.appid,
              title: "Unknown",
              image_url: " ",
              category: " ",
            }
          );
        }
      })
    );
    return gameDetails;
  } catch (err) {
    console.error("Error fetching owened games:", err.message);
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
