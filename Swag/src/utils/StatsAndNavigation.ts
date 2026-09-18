import { useState } from "react";
import { Link, useNavigate } from "react-router";

type Player = {
  id: string;
  name: string;
}

type Piece = {
  id: string;
  type: "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
  color: "white" | "black";
  square: string;
};

function goBack() {
  const navigate = useNavigate();
  navigate("/chess/classic");
}
