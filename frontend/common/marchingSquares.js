/**
 * Created by @sakri on 25-3-14.
 *
 * Javascript port of :
 * http://devblog.phillipspiess.com/2010/02/23/better-know-an-algorithm-1-marching-squares/
 * returns an Array of x and y positions defining the perimeter of a blob of non-transparent pixels on a canvas
 *
 * Modified by @c6p on 15-4-20.
 */

import simplify from 'simplify-js'

const [NONE, UP, LEFT, DOWN, RIGHT] = [...Array(5).keys()]
const [P, P2] = [10, 10*2]; // padding

// RED channel for source image
// BLUE channel for outline
const FILL = new Uint8ClampedArray([255,0,0,255])
const OUTLINE = new Uint8ClampedArray([0,255,0,255])
function isNotTransparent(rowData, i) { return rowData[i+3] >= 128}
function isTransparent(rowData, i) { return rowData[i+3] < 128}
//function isSource(rowData, i) { return rowData[i] > 0}
//function isOutline(rowData, i) { return rowData[i+1] > 0}

function hex(arr) { // arr is an uint8array
  return '#' + Array.prototype.map.call(arr, x => ('00' + x.toString(16)).slice(-2)).join('');
}

//function drawImageInColor(context, sourceCanvas, color) {
//  context.drawImage(sourceCanvas, P, P);
//  const {globalCompositeOperation} = context;
//  context.globalCompositeOperation = "source-in";
//  context.fillStyle = color;
//  const {clientWidth, clientHeight} = sourceCanvas;
//  context.fillRect(0, 0, clientWidth+P2, clientHeight+P2);
//  context.globalCompositeOperation = globalCompositeOperation;
//}

function drawThreshold(context, sourceCanvas, color, threshold=128) {
  const sourceContext = sourceCanvas.getContext("2d");
  const {width, height} = sourceContext.canvas;
  let imgData = context.createImageData(width, height);
  let d = imgData.data;
  let s = sourceContext.getImageData(0, 0, width, height).data;
  for (let i=0; i < s.length; i+=4) {
    const alpha = s[i+3];
    [d[i], d[i+1], d[i+2], d[i+3]] = alpha > threshold ? color : [0,0,0,0];
  }
  context.putImageData(imgData, P, P);  // there is a of padding 1
}

function paintPath(context, path, color) {
  context.strokeStyle = '#0f0';
  //context.fillStyle = color;
  context.beginPath();
  context.moveTo(path[0].x+P, path[0].y+P);
  for (let i = 1; i < path.length; i++) {
    context.lineTo(path[i].x+P, path[i].y+P);
    //context.rect(path[i].x+1, path[i].y+1, 1, 1);
  }
  context.stroke();
}
function compRGB(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export default class MarchingSquares {
  // Takes a canvas and returns a list of pixels that
  // define the perimeter of the upper-left most
  // object in that texture, using pixel alpha>0 to define
  // the boundary.
  getBlobOutlinePoints(sourceCanvas, scale=1) {
    const m = 1/scale;

    const [WIDTH, HEIGHT] = [sourceCanvas.width*m + P2,  sourceCanvas.height*m + P2];
    //Add a padding of 1 pixel to handle points which touch edges
    this.sourceCanvas = document.createElement("canvas");   // document.getElementById("test")
    this.sourceCanvas.width = WIDTH;
    this.sourceCanvas.height = HEIGHT;
    this.sourceContext = this.sourceCanvas.getContext("2d");
    this.sourceContext.save();
    this.sourceContext.scale(m, m)
    this.sourceContext.drawImage(sourceCanvas, P, P);
    this.sourceContext.restore();
    //this.sourceContext.scale(scale, scale)
    //drawImageInColor(this.sourceContext, sourceCanvas, hex(FILL));
    drawThreshold(this.sourceContext, this.sourceCanvas, FILL);

    //const prevPoint = (p) => p.x === 0 ? { x: WIDTH-1, y: p.y-1 } : { x: p.x-1, y: p.y };
    const getData = (p) => this.sourceContext.getImageData(p.x, p.y, 1, 1).data;
    //const isFill = (p) => getData(pos)[0] === 255;  // FILL color is RED
    const isNotOutline = (p) => !compRGB(getData(pos), OUTLINE);
    const getFirstNonTransparent = from => this.getFirstMatchingPixelTopDown(this.sourceContext, this.sourceCanvas, isNotTransparent, from);
    const getFirstTransparent = from => this.getFirstMatchingPixelTopDown(this.sourceContext, this.sourceCanvas, isTransparent, from);
    const paintOutline = (points) => paintPath(this.sourceContext, points, hex(OUTLINE));

    let paths = []
    // Find first NonTransparent
    let pos = {x:0, y:0};
    while (pos !== null) {
      pos = getFirstNonTransparent(pos);
      //console.log("NON", pos, getData(pos))
      if (pos === null) break;
      if (isNotOutline(pos)) {
        let points = this.walkPerimeter(pos.x, pos.y);
        paintOutline(points);
        //paths.push([pos.x, pos.y]);
        paths.push(simplify(points, 1, true).map(({x,y})=>{return {x:x*scale-P, y:y*scale-P, index:0}}));
        //paths.push(points);
      }
      //else
      pos = getFirstTransparent(pos);
      //console.log(pos, getData(pos))
    }

    // Return list of x and y positions
    //console.log(paths);
    return paths;
  };

  getFirstMatchingPixelTopDown(context, canvas, predicate, from={x:0,y:0}) {
    let y, i, rowData;
    i = from.x*4;
    for (y = from.y; y < canvas.height; y++) {
      rowData = context.getImageData(0, y, canvas.width, 1).data;
      for (; i < rowData.length; i += 4) {
        if (predicate(rowData, i)) {
          return { x: i / 4, y: y };
        }
      }
      i = 0;
    }
    return null;
  };

  getFirstNonTransparentPixelTopDown(canvas, p={x:0,y:0}) {
    let context = canvas.getContext("2d");
    let y, i, rowData;
    i = p.x*4;
    for (y = p.y; y < canvas.height; y++) {
      rowData = context.getImageData(0, y, canvas.width, 1).data;
      for (; i < rowData.length; i += 4) {
        if (rowData[i + 3] > 0) {
          return { x: i / 4, y: y };
        }
      }
      i = 0;
    }
    return null;
  };

  walkPerimeter(startX, startY) {
    // Do some sanity checking, so we aren't
    // walking outside the image
    // technically this should never happen
    if (startX < 0) {
      startX = 0;
    }
    if (startX > this.sourceCanvas.width) {
      startX = this.sourceCanvas.width;
    }
    if (startY < 0) {
      startY = 0;
    }
    if (startY > this.sourceCanvas.height) {
      startY = this.sourceCanvas.height;
    }

    // Set up our return list
    let pointList = [];

    // Our current x and y positions, initialized
    // to the init values passed in
    let x = startX;
    let y = startY;

    let imageData = this.sourceContext.getImageData(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    let index, width4 = imageData.width * 4;

    // The main while loop, continues stepping until
    // we return to our initial points
    do {
      // Evaluate our state, and set up our next direction
      //index = (y-1) * width4 + (x-1) * 4;
      index = (y - 1) * width4 + (x - 1) * 4;
      this.step(index, imageData.data, width4);

      // If our current point is within our image
      // add it to the list of points
      if (x >= 0 &&
        x < this.sourceCanvas.width &&
        y >= 0 &&
        y < this.sourceCanvas.height) {
        pointList.push({x:x - P, y:y - P});//offset of 1 due to the 1 pixel padding added to sourceCanvas
      }

      switch (this.nextStep) {
        case UP: y--; break;
        case LEFT: x--; break;
        case DOWN: y++; break;
        case RIGHT: x++; break;
        default:
          break;
      }

    } while (x != startX || y != startY);

    pointList.push({x:x - P, y:y - P});

    return pointList;
  };

  // Determines and sets the state of the 4 pixels that
  // represent our current state, and sets our current and
  // previous directions

  step(index, data, width4) {
    //console.log("this.step()");
    // Scan our 4 pixel area
    //imageData = this.sourceContext.getImageData(x-1, y-1, 2, 2).data;

    this.upLeft = data[index + 3] > 0;
    this.upRight = data[index + 7] > 0;
    this.downLeft = data[index + width4 + 3] > 0;
    this.downRight = data[index + width4 + 7] > 0;

    // Store our previous step
    this.previousStep = this.nextStep;

    // Determine which state we are in
    this.state = 0;

    if (this.upLeft) {
      this.state |= 1;
    }
    if (this.upRight) {
      this.state |= 2;
    }
    if (this.downLeft) {
      this.state |= 4;
    }
    if (this.downRight) {
      this.state |= 8;
    }

    // State now contains a number between 0 and 15
    // representing our state.
    // In binary, it looks like 0000-1111 (in binary)

    // An example. Let's say the top two pixels are filled,
    // and the bottom two are empty.
    // Stepping through the if statements above with a state
    // of 0b0000 initially produces:
    // Upper Left == true ==>  0b0001
    // Upper Right == true ==> 0b0011
    // The others are false, so 0b0011 is our state
    // (That's 3 in decimal.)

    // Looking at the chart above, we see that state
    // corresponds to a move right, so in our switch statement
    // below, we add a case for 3, and assign Right as the
    // direction of the next step. We repeat this process
    // for all 16 states.

    // So we can use a switch statement to determine our
    // next direction based on
    switch (this.state) {
      case 1: this.nextStep = UP; break;
      case 2: this.nextStep = RIGHT; break;
      case 3: this.nextStep = RIGHT; break;
      case 4: this.nextStep = LEFT; break;
      case 5: this.nextStep = UP; break;
      case 6:
        if (this.previousStep == UP) {
          this.nextStep = LEFT;
        } else {
          this.nextStep = RIGHT;
        }
        break;
      case 7: this.nextStep = RIGHT; break;
      case 8: this.nextStep = DOWN; break;
      case 9:
        if (this.previousStep == RIGHT) {
          this.nextStep = UP;
        } else {
          this.nextStep = DOWN;
        }
        break;
      case 10: this.nextStep = DOWN; break;
      case 11: this.nextStep = DOWN; break;
      case 12: this.nextStep = LEFT; break;
      case 13: this.nextStep = UP; break;
      case 14: this.nextStep = LEFT; break;
      default:
        this.nextStep = NONE;//this should never happen
        break;
    }
  };
};