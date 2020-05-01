import 'rc-slider/assets/index.css';
import React from 'react';
import styled from 'styled-components'
import ColorInput from './ColorInput'
import MarchingSquares from './marchingSquares'
import collide from 'line-circle-collision'
import CustomVcc from '@withkoji/custom-vcc-sdk';
import ReactTooltip from 'react-tooltip'
import {Range, Handle} from 'rc-slider';

const handle = (props) => {
  const { value, dragging, index, ...rest } = props;
  return (
    <Handle style={{display: 'flex', justifyContent: 'center'}} key={index} value={value} {...rest}>
      {dragging && <div style={{width: '4em', background: '#eeee', marginTop: '-1.5em', whiteSpace: 'nowrap', userSelect: 'none'}}>{value} ms</div>}
    </Handle>
  );
};

const Container = styled.div`
  position: relative;
`
const Header = styled.div`
  position: relative;
`
const Canvas = styled.canvas`
  position: absolute;
  cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${p => p.radius*2}' height='${p => p.radius*2}'><circle fill='%23${p => p.color}cc' stroke='gray' cx='50%' cy='50%' r='50%'/></svg>") ${p => p.radius} ${p => p.radius}, auto;
  width: 90vh;
  height: 90vh;
`
const FileInput = styled.input.attrs(props => ({
  type: "file",
}))`
  opacity: 0;
  position: absolute;
  z-index: -1;
`;

const Checkbox = styled.input.attrs(props => ({
  type: "checkbox",
}))`
`;

const NumberInput = styled.input.attrs(props => ({
  type: "number",
  min: 0,
  max: 10000
}))`
  color: #3;
  font-size: 1em;
  border: 2px solid #666;
  border-radius: 3px;
  width: 5rem;
  margin: 0.5em;
  padding: 0.5em;
  &:disabled{
    border-color: lightgray;
  }
`;

const ButtonLabel = styled.label`
  border: 2px solid #666;
  border-radius: 3px;
  margin: 0.5rem;
  padding: 0.5rem;
  background: #eee;
  &:hover{
    background-color: #666;
    color: white;
  }
`;

const Button = styled.button`
  display: inline-block;
  border-radius: 3px;
  padding: 0.5rem;
  margin: 0.5rem;
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

const RangeInput = styled.input.attrs(props => ({
  type: "range",
}))`
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
        let [disabled, period, cycles, tip] = [false, 5000, [(i-2)*500, (i-1)*500], "CUSTOM COLOR-CODED OBSTACLE<br/>Visible according to on/off times<br/>Paint it for dynamic obstacles"];
        if (i === 0) {
          [disabled, period, cycles, tip] = [true, 1000, [1000, 1000], "NO OBSTACLE<br/>Paint it to remove any obstacle"];
        } else if (i === 1) {
          [disabled, period, cycles, tip] = [true, 1000, [0, 1000], "SOLID OBSTACLE<br/>Paint it for always-on obstacles"];
        }
        return { color, period, cycles, disabled, tip };
      }),
      selected: 0,
      brushRadius: 10,
      image: ""
    };
    this.ms = new MarchingSquares()

    this.customVcc.onUpdate((newProps) => {
      if (newProps.value && newProps.value !== '') {
        const {image, obstacles} = newProps.value;
        let o = this.state.obstacles;
        this.paths = [];

        for (let i=0; i<obstacles.length; i++) {
          const {on, off, paths} = obstacles[i];
          o[i] = Object.assign(o[i], {on, off});
          this.paths.push(...paths);
        }

        this.setState({
          ...this.state,
          ...newProps,
          obstacles: o,
        }, () => {
          this.setImage(image)
          this.drawPath()
        });
      }
    });
  }

  componentDidMount() {
    this.customVcc.register('50%', '100vh');
    this.paths = [];
  }

  runMarchingSquares(point = undefined) {
    this.paths = this.ms.getBlobOutlinePoints(this.refs.canvas, SCALE)
    this.drawPath();
  }

  drawPath() {
    const {obstacles} = this.state
    const ctx = this.refs.outline.getContext("2d");
    ctx.clearRect(0, 0, GAME_SIZE, GAME_SIZE);
    ctx.lineWidth = 3;
    for (let path of this.paths) {
      for (let i=1; i < path.length; i++) {
        ctx.strokeStyle = '#'+obstacles[path[i].index].color
        ctx.beginPath();
        ctx.moveTo(path[i-1].x, path[i-1].y);
        ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
        ctx.beginPath();
      }
      ctx.stroke();
    }
  }

  detectLines(x, y) {
    const {brushRadius} = this.state;
    let lines = [];
    for (let j=0; j<this.paths.length; j++) {
      const path = this.paths[j];
      for (let i=1; i < path.length; i++) {
        const [a, b] = [path[i-1], path[i]]
        if (collide([a.x, a.y], [b.x, b.y], [x, y], brushRadius))
          lines.push([j, i])
      }
    }
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
      this.paths[l[0]][l[1]].index = parseInt(selected)
    }
    this.drawPath()
  }

  setImage(src, onLoad) {
    let img = new Image;
    img.onload = () => {
      this.setState({ image: img.src })
      const ctx = this.refs.canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, GAME_SIZE, GAME_SIZE);
      let ratio = Math.min(1024 / img.width, 1024 / img.height);
      const [w, h] = [img.width * ratio, img.height * ratio];
      const [x, y] = [(1080 - w) / 2, (1080 - h) / 2];
      ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);

      if (onLoad)
        onLoad()
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
    reader.onload = (e) => this.setImage(e.target.result, () => this.runMarchingSquares());
    reader.readAsDataURL(e.target.files[0]);
  }

  saveLevel() {
    let obstacles = this.state.obstacles.map(({period,cycles})=>{return {period,cycles}});
    /*let obstacles = this.state.obstacles.map(({period,cycles})=>{return {period,cycles,paths:[]}});
    for (let p of this.paths) {
      let obstacleIndex = p[1].index;
      let ops = obstacles[obstacleIndex].paths;
      ops.push([p[0], p[1]]);
      let opsa = ops[ops.length-1];
      for (let i=2; i<p.length; i++) {
        let oi = p[i].index;
        if (obstacleIndex === oi)
          opsa.push(p[i])
        else {
          obstacleIndex = oi;
          ops = obstacles[obstacleIndex].paths;
          ops.push([p[i-1], p[i]]);
          opsa = ops[ops.length-1];
        }
      }
    }*/
    console.log({ image: this.state.image, obstacles, paths: this.paths });

    let save = (url) => this.setState({ image: url, value: { image: url, obstacles, paths: this.paths } }, () => {
      this.customVcc.change(this.state.value);
      this.customVcc.save();
    });

    let url = this.state.image;
    if (url.startsWith('data')) {  // data-url 
      this.customVcc.uploadFile(dataURLtoBlob(url), this.state.name + '.png', (url) => save(url));
    } else if ((url.match(/\.(jpeg|jpg|webm|png)$/) != null)) {  // image url
      save(url);
    }
  }

  render() {
    const { image, obstacles, selected, brushRadius } = this.state;
    const {cycles,period,disabled,color} = obstacles[selected];
    const railStyle = { backgroundColor: 'lightgray' };
    return (
      <Container>
        <Header>
          <ButtonLabel>Select Image<FileInput id="file" onChange={this.handleImage.bind(this)}></FileInput></ButtonLabel>
          <RangeInput min={3} max={64} value={brushRadius} onChange={(e) => this.setState({ brushRadius: e.target.value })} data-tip="Brush size"></RangeInput>
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
              onChange={this.changeCycles.bind(this)}
              pushable handle={handle} trackStyle={[, railStyle,]} railStyle={railStyle} />
          </div>
          <Button disabled={disabled} onClick={this.addCycle.bind(this)}
          data-tip="Add INVISIBLE/VISIBLE cycle to tail">+</Button>
          <Button onClick={this.saveLevel.bind(this)}>Save Level</Button>
        </Header>
        <Container>
          <img src={image} style={{ display: 'none' }} width={GAME_SIZE} height={GAME_SIZE}></img>
          <Canvas ref="canvas" width={GAME_SIZE} height={GAME_SIZE}></Canvas>
          <div style={{ position: 'absolute', width: `90vh`, height: `90vh`, backgroundColor: '#dddd' }}></div>
          <Canvas ref="outline" width={GAME_SIZE} height={GAME_SIZE} radius={brushRadius} color={color}
            onMouseMove={this.paint.bind(this)} onMouseDown={this.paint.bind(this)} ></Canvas>
        </Container>
        <ReactTooltip multiline={true} />
      </Container>
    );
  }
}
//<label data-tip="Time when obstacle is VISIBLE <br/>(in miliseconds)">On:<NumberInput value={on} disabled={disabled} onChange={(e) => this.handleValue(e, 'on')}></NumberInput></label>
//<label data-tip="Time when obstacle is INVISIBLE <br/>(in miliseconds)">Off:<NumberInput value={off} disabled={disabled} onChange={(e) => this.handleValue(e, 'off')}></NumberInput></label>
//<label data-tip="Whether INVISIBLE in the BEGINNING or NOT">Start Off:<Checkbox checked={startOff} disabled={disabled} onChange={(e) => this.handleValue(e, 'startOff', 'checked')}></Checkbox></label>

export default App;
