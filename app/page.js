'use client'
import { useState } from 'react'
import styles from "./page.module.css"

function Cell ({value, inputID, pos, solution, setErrorCount, errorCount}){
  const [canditate, setCandidate] = useState(false)

  function runOnError(){
    setCandidate(false)
    setErrorCount( (count) => (count+1));
    console.log(errorCount)
  }

  function changeHandler(e){
    solution[pos[0]][pos[1]]===parseInt(e.target.value) ? setCandidate(true) : runOnError()
  }

  let compoundClass = `${styles.cell} ${styles.input}` + (canditate?" ":` ${styles.wrong}`)

  return(
      value == "x" || canditate ? // if blank or candidate is false
      <input onChange={changeHandler} id={inputID} maxlength={1} type="tel" min={0} max={9} className={compoundClass}/> 
      : <input readOnly id={inputID} type="tel" className={styles.cell} value={value}/>
  )
}

function Board ({boardValues, setBoard, solution}) {
  let row = ["r0","r1","r2","r3","r4","r5","r6","r7","r8"]
  let col = ["c0","c1","c2","c3","c4","c5","c6","c7","c8"]
  const [errorCount, setErrorCount] = useState(0)

  return (
    <>
      <p>
        ErrorCount = {errorCount}
      </p>    
      <div className={styles.board}>
        {
          row.map((r,i) => (
              col.map((c, j) => (
                  <Cell 
                    key = {`${r}${c}`} 
                    value = {boardValues[i][j]} 
                    inputID = {`${r}${c}`} 
                    pos = {[i,j]} 
                    setBoard = {setBoard} 
                    boardValues = {boardValues} 
                    solution = {solution} 
                    setErrorCount = {setErrorCount} 
                    errorCount = {errorCount}
                  />
              ))
            )
          )
        }
      </div>
    </>
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
  // }

  return (
      <main className={styles.main}>
        <Board boardValues={boardState} setBoard={setboardState} solution={solution}/>
        {/* <button className={styles.editButton} onClick={clickHandler}>edit</button> */}
      </main>
  );
}
