import 'rc-slider/assets/index.css';
import React from 'react';
import styled from 'styled-components'
import ColorInput from './ColorInput'
import MarchingSquares from './marchingSquares'
import collide from 'line-circle-collision'
import CustomVcc from '@withkoji/custom-vcc-sdk';
import ReactTooltip from 'react-tooltip'
import {Range, Handle} from 'rc-slider';

const handle = (postfix) => (props) => {
  const { value, dragging, index, ...rest } = props;
  return (
    <Handle style={{display: 'flex', justifyContent: 'center'}} key={index} value={value} {...rest}>
      {dragging && <div style={{width: '4em', background: '#eeee', marginTop: '-1.5em', whiteSpace: 'nowrap', userSelect: 'none'}}>{value} {postfix}</div>}
    </Handle>
  );
};

const Container = styled.div`
  position: relative;
`
const Header = styled.div`
  position: relative;
  background-color: #cccccccc;
`
const Canvas = styled.canvas`
  position: absolute;
  cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${p => p.radius*2}' height='${p => p.radius*2}'><circle fill='%23${p => p.color}cc' stroke='gray' cx='50%' cy='50%' r='50%'/></svg>") ${p => p.radius} ${p => p.radius}, auto;
  width: 80vh;
  height: 80vh;
`
const FileInput = styled.input.attrs(_props => ({
  type: "file",
}))`
  opacity: 0;
  position: absolute;
  z-index: -1;
`;

const Checkbox = styled.input.attrs(_props => ({
  type: "checkbox",
}))`
`;

const NumberInput = styled.input.attrs(_props => ({
  type: "number",
  min: 0,
  max: 10000
}))`
  color: #3;
  font-size: 1em;
  border: 2px solid #666;
  border-radius: 3px;
  width: 5rem;
  margin: 0.2em;
  padding: 0.2em;
  &:disabled{
    border-color: lightgray;
  }
`;

const ButtonLabel = styled.label`
  border: 2px solid #666;
  border-radius: 3px;
  margin: 0.2rem;
  padding: 0.2rem;
  background: #eee;
  &:hover{
    background-color: #666;
    color: white;
  }
`;

const Button = styled.button`
  display: inline-block;
  border-radius: 3px;
  padding: 0.2rem;
  margin: 0.2rem;
  background: #eee;
  font-family: inherit;
  font-size: 100%;
  border: 2px solid #666;
  &:hover:enabled{
    background-color: #666;
    color: white;
  }
  &:disabled{
    color: lightgray;
    border-color: lightgray;
  }
`;

const Ball = styled.div`
  border-radius: ${p => p.radius}px;
  width: ${p => p.radius*2}px;
  height: ${p => p.radius*2}px;
  background-color: white;
  border: solid 1px black;
`

const ColorPicker = styled.input.attrs(_props => ({
  type: "color",
}))`
  border: 2px solid #666;
  border-radius: 3px;
  margin: 0.2rem;
  padding: 0.2rem;
  background: #eee
  &:hover:enabled{
    background-color: #666;
    color: white;
  }
`


function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

const GAME_SIZE = 1080;
const SCALE = 4;
const STEP = 50;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.customVcc = new CustomVcc();
    this.state = {
      obstacles: ['ffffff', '000000', 'd00c27', 'ffa000', 'fff22f', 'beff00', '32cd32', 'bbd6be', '7ef9ff', '34bbe6', '4355db', 'd23be7'].map((color, i) => {
        let [disabled, period, cycles, tip] = [false, 5000, [(i-2)*500, (i-1)*500], "CUSTOM COLOR-CODED OBSTACLE<br/>Visible according to time-range<br/>Paint it for dynamic obstacles"];
        if (i === 0) {
          [disabled, period, cycles, tip] = [true, 1000, [1000, 1000], "NO OBSTACLE<br/>Paint it to remove any obstacle"];
        } else if (i === 1) {
          [disabled, period, cycles, tip] = [true, 1000, [0, 1000], "SOLID OBSTACLE<br/>Paint it for always-on obstacles"];
        }
        return { color, period, cycles, disabled, tip };
      }),
      selected: 0,
      brushRadius: 10,
      image: "",
      willScale: false,
      targetArea: 50,
      ballRadius: 30,
      balls: [30, 30, 15, 15, 15],
      backgroundColor: '#333333',
      showOutline: true,
      canvasSize: GAME_SIZE
    };
    this.ms = new MarchingSquares()

    this.customVcc.onUpdate((newProps) => {
      if (newProps.value && newProps.value !== '') {
        const {image, obstacles, path, targetArea} = newProps.value;
        let o = this.state.obstacles;
        this.path = path;

        for (let i=0; i<obstacles.length; i++) {
          const {period, cycles} = obstacles[i];
          o[i] = Object.assign(o[i], {period, cycles});
        }

        this.setState({
          ...this.state,
          ...newProps.value,
          obstacles: o,
          targetArea: targetArea*100
        }, () => {
          this.setImage(image)
          this.drawPath()
        });
      }
    });
  }

  componentDidMount() {
    this.customVcc.register('50%', '100vh');
    this.path = [];
    this.setState({canvasSize: this.refs.canvas.getBoundingClientRect().width});
  }

  runMarchingSquares(_point = undefined) {
    this.path = this.ms.getBlobOutlinePoints(this.refs.canvas, SCALE)
    this.drawPath();
  }

  drawPath() {
    const {obstacles} = this.state
    const ctx = this.refs.outline.getContext("2d");
    ctx.clearRect(0, 0, GAME_SIZE, GAME_SIZE);
    ctx.lineWidth = 3;
    //for (let path of this.paths) {
      let path = this.path;
      for (let i=1; i < path.length; i++) {
        ctx.strokeStyle = '#'+obstacles[path[i].index].color
        ctx.beginPath();
        ctx.moveTo(path[i-1].x, path[i-1].y);
        ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
        ctx.beginPath();
      }
      ctx.stroke();
    //}
  }

  detectLines(x, y) {
    const {brushRadius} = this.state;
    let lines = [];
    //for (let j=0; j<this.paths.length; j++) {
      const path = this.path;
      for (let i=1; i < path.length; i++) {
        const [a, b] = [path[i-1], path[i]]
        if (collide([a.x, a.y], [b.x, b.y], [x, y], brushRadius))
          lines.push(i)
      }
    //}
    return lines;
  }

  paint(e) {
    if (e.buttons === 0)
      return;
    const {selected} = this.state;
    const {clientX, clientY} = e;
    const {left, top} = e.target.getBoundingClientRect();
    const [x, y] = [clientX-left, clientY-top];
    const m = GAME_SIZE/this.refs.canvas.offsetHeight;
    let lines = this.detectLines(x*m,y*m)
    for (let l of lines) {
      this.path[l].index = parseInt(selected)
    }
    this.drawPath()
  }

  setImage(src, onLoad) {
    let img = new Image;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ctx = this.refs.canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, GAME_SIZE, GAME_SIZE);
      let ratio = Math.min(1024 / img.width, 1024 / img.height);
      const [w, h] = [Math.round(img.width * ratio), Math.round(img.height * ratio)];
      const [x, y] = [Math.round((1080 - w) / 2), Math.round((1080 - h) / 2)];
      ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);

      if (onLoad)
        onLoad(this.refs.canvas, x, y, w, h);
      else
        this.setState({ image: img.src });
    }
    img.src = src;
  }

  setStateObstacles(obstacles) {
    this.setState(prevState => ({
      ...prevState,
      obstacles: [...obstacles]
    }))
  }

  changePeriod(e) {
    let {obstacles, selected} = this.state;
    obstacles[selected].period = Math.floor(e.target.value / STEP) * STEP;
    this.setStateObstacles(obstacles);
  }
  removeCycle() {
    let {obstacles, selected} = this.state;
    let o = obstacles[selected];
    const len = o.cycles.length;
    if (len <= 2)
      return
    o.cycles.splice(len-2, 2);
    this.setStateObstacles(obstacles);
  }
  addCycle() {
    let {obstacles, selected} = this.state;
    let o = obstacles[selected];
    const last = o.cycles[o.cycles.length-1];
    if (last >= o.period)
      return;
    o.cycles.push(Math.max(o.period-500, ), o.period);
    this.setStateObstacles(obstacles);
  }
  changeCycles(v) {
    let {obstacles, selected} = this.state;
    obstacles[selected].cycles = v;
    this.setStateObstacles(obstacles);
  }

  handleRadio(e) {
    this.setState({selected: e.target.value});
  }

   handleImage(e) {
    let reader = new FileReader();
    reader.onload = (e) => this.setImage(e.target.result, (canvas, x, y, w, h) => {
      let imageContentRaw = canvas.getContext('2d').getImageData(x,y,w,h);
      let c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').putImageData(imageContentRaw, 0, 0);
      this.setState({ image: c.toDataURL() })

      this.runMarchingSquares()
    });
    reader.readAsDataURL(e.target.files[0]);
  }

  addBall() {
    let {balls, ballRadius} = this.state;
    if (balls.length >= 10)
      return;
    balls.push(ballRadius),
    this.setState({balls});
  }

  removeBall(i) {
    let {balls} = this.state;
    balls.splice(i, 1);
    this.setState({balls});
  }

  saveLevel() {
    const {willScale, targetArea, balls, backgroundColor} = this.state;
    let obstacles = this.state.obstacles.map(({period,cycles})=>{return {period,cycles}});

    let save = (url) => this.setState({ image: url, value: { image: url, backgroundColor, willScale, targetArea: targetArea/100, balls, obstacles, path: this.path } }, () => {
      this.customVcc.change(this.state.value);
      this.customVcc.save();
      console.log(this.state.value);
    });

    let url = this.state.image;
    console.log(url)
    if (url.startsWith('data')) {  // data-url 
      this.customVcc.uploadFile(dataURLtoBlob(url), this.state.name + '.png', (url) => save(url));
    } else if ((url.match(/\.(jpeg|jpg|webm|png)$/) != null)) {  // image url
      save(url);
    }
  }

  render() {
    const { image, obstacles, selected, brushRadius, willScale, targetArea, ballRadius, balls, backgroundColor, showOutline, canvasSize} = this.state;
    const {cycles,period,disabled,color} = obstacles[selected];
    const railStyle = { backgroundColor: 'lightgray' };
    const handle_px = handle("px");
    //const ratio = canvasSize / GAME_SIZE;
    return (
      <Container>
        <Header>
          <div style={{display: "inline-block", backgroundColor: "#ddddffdd"}}>
          <label data-tip="Show/Hide obstacle layer">Show Obstacle Layer?<Checkbox checked={showOutline} onChange={(e) => this.setState({ showOutline: e.target.checked})}></Checkbox></label>
          <Button onClick={this.saveLevel.bind(this)}>Save Level</Button>
          <ButtonLabel data-tip="An image with transparency<br/>as game area for edge detection">Select Image<FileInput id="file" onChange={this.handleImage.bind(this)}></FileInput></ButtonLabel>
          </div>
          <div style={{display: "inline-block", backgroundColor: "#ffdddddd", verticalAlign: "bottom"}}>
          <ColorPicker data-tip="Level background color" value={backgroundColor} onChange={e => this.setState({backgroundColor: e.target.value})}></ColorPicker>
          <label data-tip="Whether image will continuously<br/>scale to fill the level">Scaling?<Checkbox checked={willScale} onChange={(e) => this.setState({ willScale: e.target.checked})}></Checkbox></label>
          <div style={{ display: 'inline-block', width: '150px' }} data-tip="Target area % to pass level">
          <Range min={1} max={99} value={[targetArea]} handle={handle('%')} onChange={(v) => this.setState({ targetArea: v })}></Range>
          </div>
          </div>
          <div>
          <div style={{ display: 'inline-block', width: '150px' }} data-tip="Brush size">
          <Range min={3} max={64} value={[brushRadius]} handle={handle_px} onChange={(v) => this.setState({ brushRadius: v })}></Range>
          </div>
          {this.state.obstacles.map((c, i) =>
            <ColorInput key={i} color={c.color} value={i} data-tip={c.tip}
              checked={this.state.selected == i} onChange={this.handleRadio.bind(this)}
            ></ColorInput>
          )}
          <label data-tip="Total period (ms)<br/>VISIBLE/INVISIBLE cycle">
            <NumberInput value={period} min={STEP} max={10000} step={STEP} disabled={disabled} onChange={this.changePeriod.bind(this)}></NumberInput>
          </label>
          <Button disabled={disabled} onClick={this.removeCycle.bind(this)}
          data-tip="Remove INVISIBLE/VISIBLE cycle from tail">-</Button>
          <div style={{ display: 'inline-block', width: '300px' }}
            data-tip="VISIBLE in painted time-range<br/>INVISIBLE on gray>">
            <Range count={cycles.length} value={cycles} min={0} max={period} step={STEP} disabled={disabled}
              onChange={this.changeCycles.bind(this)} postfix={"ms"}
              pushable handle={handle("ms")} trackStyle={[, railStyle,]} railStyle={railStyle} />
          </div>
          <Button disabled={disabled} onClick={this.addCycle.bind(this)}
          data-tip="Add INVISIBLE/VISIBLE cycle to tail">+</Button>
          </div>
        </Header>
        <Container>
          <div style={{ position: 'absolute', width: `80vh`, height: `80vh`, backgroundColor: backgroundColor }}></div>
          <img src={image} style={{ display: 'none' }} width={GAME_SIZE} height={GAME_SIZE}></img>
          <Canvas ref="canvas" width={GAME_SIZE} height={GAME_SIZE}></Canvas>
          <div style={{ position: "absolute", display: showOutline ? 'block' : 'none'}}>
          <div style={{ position: 'absolute', width: `80vh`, height: `80vh`, backgroundColor: '#dddd' }}></div>
          <Canvas ref="outline" width={GAME_SIZE} height={GAME_SIZE} radius={brushRadius} color={color}
            onMouseMove={this.paint.bind(this)} onMouseDown={this.paint.bind(this)} ></Canvas>
            </div>
        </Container>
        {
        <Container style={{position: 'absolute', display: 'flex', flexFlow: 'column', alignItems: 'center', left: canvasSize }}>
          <div style={{ display: 'inline-block', height: '150px' }} data-tip="Radius of balls to add">
          <Range vertical min={10} max={40} value={[ballRadius]} handle={handle_px}
          onChange={(v) => this.setState({ ballRadius: v })} ></Range>
          </div>
          <Button onClick={this.addBall.bind(this)}>Add Ball</Button>
          {balls.map((b,i) => <Ball data-tip="Click on a ball to remove" onClick={() => this.removeBall(i)} key={i} radius={b * canvasSize / GAME_SIZE}></Ball>)}
        </Container>
        }
        <ReactTooltip place="bottom" multiline={true} />
      </Container>
    );
  }
}

export default App;
