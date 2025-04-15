import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://your-render-url.onrender.com');

const contractList = ['Queens', 'King of Hearts', 'Diamonds', 'Slaps', 'Trix'];

function App() {
  const [nickname, setNickname] = useState('');
  const [roomID, setRoomID] = useState('');
  const [inputRoomID, setInputRoomID] = useState('');
  const [players, setPlayers] = useState([]);
  const [hand, setHand] = useState([]);
  const [contract, setContract] = useState('');
  const [scores, setScores] = useState({});
  const [isOwner, setIsOwner] = useState(false);
  const [currentTurn, setCurrentTurn] = useState('');
  const [playedCards, setPlayedCards] = useState([]);
  const [error, setError] = useState('');
  const [isChoosingContract, setIsChoosingContract] = useState(false);
  const [selectedContract, setSelectedContract] = useState('');
  const [doubles, setDoubles] = useState({});

  const createRoom = () => {
    if (!nickname) return setError('Enter nickname');
    socket.emit('create-room', { nickname });
  };

  const joinRoom = () => {
    if (!nickname || !inputRoomID) return setError('Enter nickname and room ID');
    socket.emit('join-room', { roomID: inputRoomID.toUpperCase(), nickname });
  };

  const startGame = () => {
    socket.emit('start-game', roomID);
  };

  const playCard = (card) => {
    if (currentTurn !== socket.id) return;
    socket.emit('play-card', { roomID, card });
    setHand(prev => prev.filter(c => c !== card));
  };

  const submitContract = () => {
    socket.emit('choose-contract', {
      roomID,
      contract: selectedContract,
      doubles,
    });
    setIsChoosingContract(false);
  };

  useEffect(() => {
    socket.on('room-created', (id) => {
      setRoomID(id);
      setIsOwner(true);
      setError('');
    });

    socket.on('joined-room', (id) => {
      setRoomID(id);
      setIsOwner(false);
      setError('');
    });

    socket.on('room-not-found', () => setError('Room not found or full.'));

    socket.on('update-players', (players) => setPlayers(players));

    socket.on('choose-contract-turn', (playerId) => {
      if (socket.id === playerId) {
        setIsChoosingContract(true);
        setSelectedContract('');
        setDoubles({});
      }
    });

    socket.on('new-contract', ({ contract, hands, doubles }) => {
      setContract(contract);
      setHand(hands[socket.id]);
      setDoubles(doubles || {});
      setPlayedCards([]);
    });

    socket.on('turn-changed', (playerId) => setCurrentTurn(playerId));

    socket.on('card-played', ({ playerId, card }) => {
      setPlayedCards(prev => [...prev, { playerId, card }]);
    });

    socket.on('update-scores', (scores) => setScores(scores));

    socket.on('game-ended', (finalScores) => {
      alert('Game ended!\n' + JSON.stringify(finalScores, null, 2));
    });

    return () => socket.disconnect();
  }, []);

  const getNickname = (id) => players.find((p) => p.id === id)?.nickname || id;

  return (
    <div style={{ fontFamily: 'Arial', textAlign: 'center', marginTop: 30 }}>
      <h1>Trix Online</h1>

      {!roomID ? (
        <div>
          <input
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{ margin: '5px' }}
          />
          <br />
          <button onClick={createRoom}>Create Room</button>
          <div style={{ marginTop: '20px' }}>
            <input
              placeholder="Room ID"
              value={inputRoomID}
              onChange={(e) => setInputRoomID(e.target.value)}
              style={{ margin: '5px' }}
            />
            <button onClick={joinRoom}>Join Room</button>
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <div>
          <h2>Room: {roomID}</h2>
          <h3>Contract: {contract || 'Waiting...'}</h3>

          <h4>Players:</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {players.map((p) => (
              <li key={p.id}>
                {p.nickname} {p.id === currentTurn && ' 🎮'}
              </li>
            ))}
          </ul>

          {isChoosingContract && (
            <div>
              <h3>Choose a contract:</h3>
              {contractList.map((c) => (
                <div key={c}>
                  <input
                    type="radio"
                    name="contract"
                    value={c}
                    checked={selectedContract === c}
                    onChange={() => setSelectedContract(c)}
                  />
                  <label>{c}</label>
                </div>
              ))}

              {(selectedContract === 'Queens' || selectedContract === 'King of Hearts') && (
                <div style={{ marginTop: 10 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={doubles['Q'] || false}
                      onChange={(e) =>
                        setDoubles((prev) => ({ ...prev, Q: e.target.checked }))
                      }
                    />
                    Double Queens
                  </label>
                  <br />
                  <label>
                    <input
                      type="checkbox"
                      checked={doubles['K-H'] || false}
                      onChange={(e) =>
                        setDoubles((prev) => ({ ...prev, 'K-H': e.target.checked }))
                      }
                    />
                    Double King of Hearts
                  </label>
                </div>
              )}

              <button style={{ marginTop: 10 }} onClick={submitContract}>
                Confirm Contract
              </button>
            </div>
          )}

          {hand.length === 0 ? (
            players.length < 4 ? (
              <p>Waiting for players...</p>
            ) : isOwner ? (
              <button onClick={startGame}>Start Game</button>
            ) : (
              <p>Waiting for game to start...</p>
            )
          ) : (
            <>
              <h3>Your Hand:</h3>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                }}
              >
                {hand.map((card) => (
                  <div
                    key={card}
                    onClick={() => playCard(card)}
                    style={{
                      padding: '10px',
                      margin: '5px',
                      border: '1px solid black',
                      borderRadius: '8px',
                      cursor: currentTurn === socket.id ? 'pointer' : 'not-allowed',
                      backgroundColor: 'white',
                      width: '60px',
                      transition: 'transform 0.3s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {card}
                  </div>
                ))}
              </div>

              <h3>Played Cards:</h3>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                {playedCards.map(({ playerId, card }, index) => (
                  <div key={index} style={{ margin: '5px' }}>
                    {getNickname(playerId)}: {card}
                  </div>
                ))}
              </div>

              <h3>Scores:</h3>
              <ul style={{ listStyle: 'none' }}>
                {Object.entries(scores).map(([id, score]) => (
                  <li key={id}>
                    {getNickname(id)}: {score} pts
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
