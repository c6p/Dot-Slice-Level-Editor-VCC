import React from 'react';
import styled from 'styled-components';

const Input = styled.input.attrs(props => ({
  type: "radio",
}))`
  display: none;
  &:checked + span {
    transform: scale(1.25);
  }
  &:hover + span {
    transform: scale(1.25);
  }
  & + span {
    display: block;
    border: 2px solid gray;
    width: 100%;
    height: 100%;
    transition: transform .1s ease-in-out;
    background-color: #${props => props.id};
  }
`

const Label = styled.label`
  display: inline-block;
  width: 15px;
  height: 15px;
  margin-right: 5px;
`

class ColorInput extends React.Component {
  render() {
    const {color} = this.props;
    return (
      <Label data-tip={this.props['data-tip']}>
        <Input id={color} {...this.props}></Input>
        <span className={color}></span>
      </Label>
    )
  }
}

export default ColorInput;