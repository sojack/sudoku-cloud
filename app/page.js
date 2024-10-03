'use client'
import { useState } from "react";
import styles from "./page.module.css";

function Cell ({value, inputID, pos, setBoard, boardValues, solution}){
  const [canditate, setCandidate] = useState(false)

  function changeHandler(e){
    // console.log(boardValues)
    let newBoard=boardValues
    newBoard[pos[0]][pos[1]]=e.target.value
    let isCorrect= 0||solution[pos[0]][pos[1]]===parseInt(e.target.value)
    setBoard(newBoard)
    solution[pos[0]][pos[1]]===parseInt(e.target.value) ? setCandidate(true):setCandidate(false)
  }
  return(
    value=="x" ? 
      <input onChange={changeHandler} id={inputID} type="number" className={`${styles.cell} ${styles.input}` + (canditate?" ":` ${styles.wrong}`)}/> 
      : <input readOnly id={inputID} type="number" className={styles.cell} value={value}/>
  )
}

function Board ({boardValues, setBoard, solution}) {
  let row = ["r0","r1","r2","r3","r4","r5","r6","r7","r8"]
  let col = ["c0","c1","c2","c3","c4","c5","c6","c7","c8"]
  
  const [guess, setGuess] = useState(false)
  
  function changeHandler(e){
    let value=e.target.value
    let row = e.target.id.charAt(1)
    let col = e.target.id.charAt(3)
    let correctValue = solution[row][col]
    (value===correctValue) ? setGuess(true): setGuess(false)
    console.log(`column: ${col} row: ${row} Value: ${value} CorrectValue: ${correctValue} ${guess}`)
  }

  // let colorIndicator
  // guess ? colorIndicator=styles.right : colorIndicator=styles.wrong

  return (
    <div className={styles.board}>
      {
        row.map((r,i) => (
            col.map((c, j) => (
                <Cell key={`${r}${c}`} value={boardValues[i][j]} inputID={`${r}${c}`} pos={[i,j]} setBoard={setBoard} boardValues={boardValues} solution={solution}/>
            ))
          )
        )
      }
    </div>
  )
}

export default function Home() {

  let defaultBoard = [
    [7,2,'x','x','x','x','x','x','x'],
    ['x',5,'x','x','x',9,'x','x','x'],
    ['x','x','x','x',3,8,'x','x','x'],
    ['x','x','x',4,'x','x',5,'x','x'],
    ['x','x',3,'x','x','x',9,'x','x'],
    ['x','x',1,'x','x',3,'x','x','x'],
    ['x','x','x',2,5,'x','x','x','x'],
    ['x','x','x',6,'x','x','x',3,'x'],
    ['x','x','x','x','x','x','x',1,9]
  ]

  let solution = [
    [7,2,9,1,4,6,3,5,8],
    [3,5,8,7,2,9,1,4,6],
    [4,1,6,5,3,8,7,9,2],
    [8,9,7,4,1,2,5,6,3],
    [2,4,3,8,6,5,9,7,1],
    [5,6,1,9,7,3,8,2,4],
    [9,3,4,2,5,1,6,8,7],
    [1,8,2,6,9,7,4,3,5],
    [6,7,5,3,8,4,2,1,9]
  ]
  const [boardState, setboardState] = useState(defaultBoard)

  // function resetBoard() {
  //   setboardState([
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //     'x','x','x','x','x','x','x','x','x',
  //   ])
  //   console.log(boardState)
  // }

  return (
      <main className={styles.main}>
        <Board boardValues={boardState} setBoard={setboardState} solution={solution}/>
        {/* <button className={styles.editButton} onClick={clickHandler}>edit</button> */}
      </main>
  );
}
