import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Client from '../components/Client';

import Editor from '../components/Editor';
import { io } from 'socket.io-client'; // Direct import instead of initSocket
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        let socket;
        const init = async () => {
            try {
                // Initialize socket connection
                socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
                    'force new connection': true,
                    reconnectionAttempts: Infinity,
                    timeout: 10000,
                    transports: ['websocket'],
                });

                socketRef.current = socket;
                setIsConnected(true);

                const handleErrors = (e) => {
                    console.error('Socket error:', e);
                    toast.error('Connection failed. Trying to reconnect...');
                    setIsConnected(false);
                };

                socket.on('connect_error', handleErrors);
                socket.on('connect_failed', handleErrors);
                socket.on('disconnect', () => setIsConnected(false));
                socket.on('reconnect', () => setIsConnected(true));

                socket.emit(ACTIONS.JOIN, {
                    roomId,
                    username: location.state?.username,
                });

                // Listening for joined event
                socket.on(
                    ACTIONS.JOINED,
                    ({ clients, username, socketId }) => {
                        if (username !== location.state?.username) {
                            toast.success(`${username} joined the room.`);
                        }
                        setClients(clients);
                        socket.emit(ACTIONS.SYNC_CODE, {
                            code: codeRef.current,
                            socketId,
                        });
                    }
                );

                // Listening for disconnected
                socket.on(
                    ACTIONS.DISCONNECTED,
                    ({ socketId, username }) => {
                        toast.success(`${username} left the room.`);
                        setClients((prev) => prev.filter(
                            (client) => client.socketId !== socketId
                        ));
                    }
                );

            } catch (err) {
                console.error('Socket initialization failed:', err);
                toast.error('Failed to connect to the server');
                reactNavigator('/');
            }
        };

        init();

        return () => {
            if (socketRef.current) {
                // Clean up all event listeners
                socketRef.current.off('connect_error');
                socketRef.current.off('connect_failed');
                socketRef.current.off('disconnect');
                socketRef.current.off('reconnect');
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [roomId, location.state?.username, reactNavigator]);

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID copied to clipboard');
        } catch (err) {
            toast.error('Failed to copy Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        reactNavigator('/');
    }

    if (!location.state) {
        return <Navigate to="/" />;
    }

    return (
        <div className="mainWrap">
            <div className="connection-status" style={{
                position: 'fixed',
                top: 10,
                right: 10,
                padding: '5px 10px',
                background: isConnected ? '#4CAF50' : '#F44336',
                color: 'white',
                borderRadius: 4
            }}>
                {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            
            <div className="aside">
                <div className="asideInner">
                    <div className="logo">
                        <img
                            className="logoImage"
                            src="/codeRoom.png"
                            alt="logo"
                        />
                    </div>
                    <h3>Connected</h3>
                    <div className="clientsList">
                        {clients.map((client) => (
                            <Client
                                key={client.socketId}
                                username={client.username}
                            />
                        ))}
                    </div>
                </div>
                <button className="btn copyBtn" onClick={copyRoomId}>
                    Copy ROOM ID
                </button>
                <button className="btn leaveBtn" onClick={leaveRoom}>
                    Leave
                </button>
            </div>
            <div className="editorWrap">
                <Editor
                    socketRef={socketRef}
                    roomId={roomId}
                    onCodeChange={(code) => {
                        codeRef.current = code;
                    }}
                />
            </div>
        </div>
    );
};

export default EditorPage;