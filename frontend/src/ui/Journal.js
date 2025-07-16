import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Journal.css";

const Journal = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/journals")
      .then((res) => {
        setEntries(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch journals:", err);
        setError("Could not load journal entries");
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading journal…</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="journal-page">
      <h1>Journal</h1>
      {entries.length === 0 ? (
        <p>No entries yet.</p>
      ) : (
        <table className="journal-table">
          <thead>
            <tr>
              <th>Game</th>
              <th>Entry</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td>{e.title}</td>
                <td>{e.entry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Journal;
