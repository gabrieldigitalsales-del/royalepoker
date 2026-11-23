import React, { useState } from "react";
import { Card, Modal } from "./ui";

const exercises = [
  {
    game: "Texas Hold’em",
    cards: ["As", "Kd"],
    board: ["2h", "7c", "Js"],
    prompt: "Ninguém apostou. Passe a vez sem colocar fichas.",
    options: ["FOLD", "CHECK", "BET"],
    correct: "CHECK",
    explanation: "Check passa a vez quando não há uma aposta para pagar.",
  },
  {
    game: "Omaha 4",
    cards: ["As", "Ks", "Qd", "Jc"],
    board: ["2s", "5s", "9s", "Th"],
    prompt: "Quantas cartas da sua mão você precisa usar para formar o jogo?",
    options: ["Uma", "Duas", "Três"],
    correct: "Duas",
    explanation:
      "Em Omaha, a combinação usa exatamente duas cartas próprias e três comunitárias.",
  },
  {
    game: "Texas Hold’em",
    cards: ["Ac", "Ah"],
    board: [],
    prompt:
      "O rival foi all-in de 100. Você já investiu 10 e tem 15 fichas restantes. Escolha o call válido.",
    options: ["CALL 90", "CALL 15", "CALL 100"],
    correct: "CALL 15",
    explanation:
      "Você paga as 15 fichas restantes e disputa apenas o pote que sua contribuição cobre.",
  },
  {
    game: "Five Card Draw",
    cards: ["7h", "7d", "Ac", "4s", "2h"],
    board: [],
    prompt:
      "Você quer manter o par de setes e trocar todas as outras cartas. Quantas descarta?",
    options: ["Uma", "Duas", "Três"],
    correct: "Três",
    explanation: "Guarde os dois setes e descarte as outras três cartas.",
  },
];

export function Practice({ close }: { close: () => void }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const exercise = exercises[index];
  return (
    <Modal title="Treino de poker" close={close}>
      <div className="practice-table">
        <small>
          {exercise.game} · {index + 1}/{exercises.length}
        </small>
        {!!exercise.board.length && (
          <div className="row" aria-label="Cartas comunitárias">
            {exercise.board.map((card) => (
              <Card key={card} c={card} />
            ))}
          </div>
        )}
        <div className="row" aria-label="Suas cartas">
          {exercise.cards.map((card) => (
            <Card key={card} c={card} />
          ))}
        </div>
        <p>{exercise.prompt}</p>
        <div className="row">
          {exercise.options.map((option) => (
            <button
              key={option}
              aria-pressed={answer === option}
              onClick={() => setAnswer(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {answer && (
          <p role="status">
            <strong>
              {answer === exercise.correct ? "Correto. " : "Tente de novo. "}
            </strong>
            {answer === exercise.correct && exercise.explanation}
          </p>
        )}
        {answer === exercise.correct && (
          <button
            className="primary"
            onClick={() => {
              setIndex((index + 1) % exercises.length);
              setAnswer("");
            }}
          >
            {index < exercises.length - 1
              ? "Próximo exercício"
              : "Recomeçar treino"}
          </button>
        )}
      </div>
    </Modal>
  );
}
