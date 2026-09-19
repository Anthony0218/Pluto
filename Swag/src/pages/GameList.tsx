import "./GameList.css";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ChessMenu from "./ChessMenu";
import OnlineGame from "./OnlineGame";
import Watten from "./Watten";
import ChessVariantsMenu from "./ChessVariantsMenu";

interface BoxProps {
  title: string;
  children: React.ReactNode;
}
function Box({ title, children }: BoxProps) {
  return (
    <div className="box">
      <div className="box-header">
        <h2>{title}</h2>
      </div>

      <div className="box-content">
        {children}
      </div>
    </div>
  );
}

interface GameContainerProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}
function GameContainer({
  children,
  onClick,
  className = "",
}: GameContainerProps) {
  return (
    <div
      className={`game-container ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

const chessMenu = [
    {
      title: "Classic",
      description:
        "Play standard against another player or the computer.",
      path: "/games/chess/classic",
      icon: "♚",
    },
    {
      title: "Variants",
      description: "Play Chess960 and other alternative variants.",
      path: "/games/chess/variants",
      icon: "♕",
    },
    {
      title: "Custom",
      description:
        "Create and play games with your own rules and concepts.",
      path: "/games/chess/custom",
      icon: "♞",
    },
  ];

export default function GameList() {
    const [gamesVisible, setGamesVisible] = useState(true);
    return (
        <>
            <Link to="/games">
            </Link>  
            <div className="games-container">
                <GameContainer 
                onClick={
                    () => setGamesVisible(!gamesVisible)}
                    > 
                    {gamesVisible && ( 
                    <>
                        <Box title="Chess">
                        <ChessMenu />
                        </Box>

                        <Box className="mt-12 grid gap-6 md:grid-cols-3" title="chessMenu">
                            {chessMenu.map((mode) => (
                            <Link
                                key={mode.path}
                                to={mode.path}
                                className="
                                    group
                                    rounded-3xl
                                    border
                                    border-white/10
                                    bg-zinc-900
                                    p-7
                                    transition
                                    hover:-translate-y-1
                                    hover:border-amber-400/50
                                    hover:bg-zinc-800
                                "
                                >
                                <div className="text-5xl">{mode.icon}</div>

                                <h2 className="mt-6 text-2xl font-black">{mode.title}</h2>

                                <p className="mt-3 text-sm leading-6 text-zinc-400">
                                    {mode.description}
                                </p>

                                <p className="mt-6 text-sm font-bold text-amber-400">Spielen →</p>
                                </Link>
                            ))}
                        </Box>
                    </>
                    )
                    }
                </GameContainer>
                
                <Box title="Multiplayer">
                <OnlineGame />
                </Box>

                <Box title="Watten">
                <Watten />
                </Box>
                
            </div>    
        </>
    )
}