import React, { useEffect, useContext, useRef, useState } from "react";
import "./CurvesModal.css";
import PropTypes from "prop-types";
import TheButton from "@components/Button/TheButton";
import { ImageContext } from "@/ImageProvider";
import * as d3 from "d3";
import Input from "@components/Input/Input";
import calculateCurves from "@utils/ImageProcessing/calculateCurves";

const CurvesModal = ({ imageCtx, closeModal, showPreview }) => {
  const { image, setImage } = useContext(ImageContext);
  const [arrData, setArrData] = useState([]);
  const [inA, setInA] = useState(0);
  const [outA, setOutA] = useState(0);
  const [inB, setInB] = useState(255);
  const [outB, setOutB] = useState(255);
  const [arrR, setArrR] = useState([]);
  const [arrG, setArrG] = useState([]);
  const [arrB, setArrB] = useState([]);
  const [previewActive, setPreviewActive] = useState(false);
  const preview = useRef(null);

  useEffect(() => {
    if (!imageCtx) return;
    const canvasRef = preview.current;
    const ctx = canvasRef.getContext("2d");
    const imageObj = new Image();
    imageObj.src = image;
    imageObj.crossOrigin = "anonymous";
    imageObj.onload = () => {
      canvasRef.width = imageObj.width;
      canvasRef.height = imageObj.height;
      ctx.drawImage(imageObj, 0, 0);
      const data = ctx.getImageData(0, 0, imageObj.width, imageObj.height).data;
      setArrData(data);
      const tempArr = [new Array(256).fill(0), new Array(256).fill(0), new Array(256).fill(0)];

      for (let i = 0; i < data.length; i += 4) {
        tempArr[0][data[i]]++;     // Red
        tempArr[1][data[i + 1]]++; // Green
        tempArr[2][data[i + 2]]++; // Blue
      }

      setArrR(tempArr[0]);
      setArrG(tempArr[1]);
      setArrB(tempArr[2]);
    };
  }, [imageCtx]);

  useEffect(() => {
    if (!arrR.length || !arrG.length || !arrB.length) return;

    const maxV = Math.max(...arrR, ...arrG, ...arrB);
    const scaleData = (arr) => arr.map((val) => (val / maxV) * 255);

    buildHistogram(scaleData(arrR), scaleData(arrG), scaleData(arrB));
    handlePreview(previewActive);
  }, [inA, outA, inB, outB, imageCtx, arrR, arrG, arrB]);

  const buildHistogram = (dataR, dataG, dataB) => {
    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = 500 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    d3.select("#histogram").selectAll("*").remove();

    const svg = d3.select("#histogram")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 255]).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max([d3.max(dataR), d3.max(dataG), d3.max(dataB)])]).range([height, 0]);

    const color = d3.scaleOrdinal().domain(["dataR", "dataG", "dataB"]).range(["red", "green", "blue"]);

    [dataR, dataG, dataB].forEach((data, index) => {
      svg.append("path")
        .datum(data)
        .attr("class", "line")
        .style("stroke", color(`data${['R', 'G', 'B'][index]}`))
        .style("fill", "none")
        .attr("d", d3.line()
          .x((d, i) => x(i))
          .y((d) => y(d))
          .curve(d3.curveMonotoneX)); // Changed to curveMonotoneX for smoother lines
    });

    svg.append("g").attr("class", "x axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues(d3.range(0, 256, 15)));
    svg.append("g").attr("class", "y axis").call(d3.axisLeft(y).tickValues(d3.range(0, d3.max([d3.max(dataR), d3.max(dataG), d3.max(dataB)]) + 1, 15)));

    const drawPoint = (className, xValue, yValue, setX, setY, minX, maxX) => {
      svg.selectAll(`.${className}`)
        .data([{ x: xValue, y: yValue }])
        .join("circle")
        .attr("class", className)
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", 5)
        .style("fill", "currentColor")
        .style("cursor", "move")
        .call(d3.drag()
          .on("start", function () { d3.select(this).raise().attr("stroke", "red"); })
          .on("drag", function (event) {
            const svgRect = document.getElementById("histogram").getBoundingClientRect();
            const svgX = event.x - svgRect.left;
            const svgY = event.y - svgRect.top;
            const newX = Math.max(minX, Math.min(maxX, x.invert(svgX)));
            const newY = Math.max(0, Math.min(255, y.invert(svgY)));
            setX(Math.round(newX));
            setY(Math.round(newY));
          })
          .on("end", function () { d3.select(this).attr("stroke", null); }));
    };

    drawPoint("pointA", inA, outA, setInA, setOutA, 0, inB - 1);
    drawPoint("pointB", inB, outB, setInB, setOutB, inA + 1, 255);

    svg.append("line").attr("class", "line").attr("x1", x(inA)).attr("y1", y(outA)).attr("x2", x(inB)).attr("y2", y(outB)).style("stroke", "currentColor").style("stroke-width", 1.2);
    svg.append("line").attr("class", "line").attr("x1", x(0)).attr("y1", y(outA)).attr("x2", x(inA)).attr("y2", y(outA)).style("stroke", "currentColor").style("stroke-width", 1.2);
    svg.append("line").attr("class", "line").attr("x1", x(255)).attr("y1", y(outB)).attr("x2", x(inB)).attr("y2", y(outB)).style("stroke", "currentColor").style("stroke-width", 1.2);

    svg.append("text").attr("transform", "rotate(-90)").attr("y", 0 - margin.left).attr("x", 0 - height / 2).attr("dy", "1em").style("text-anchor", "middle").text("Выход").style("fill", "currentColor");
    svg.append("text").attr("transform", `translate(${width / 2},${height + margin.top + 20})`).style("text-anchor", "middle").text("Вход").style("fill", "currentColor");
    svg.append("text").attr("x", width / 2).attr("y", 0 - margin.top / 2).attr("text-anchor", "middle").style("font-size", "12px").style("font-weight", "600").text("RGB Гистограмма").style("fill", "currentColor");
  };

  const handleCurves = (isPreview) => {
    const newData = calculateCurves(arrData, inA, outA, inB, outB);
    const img = new Image();
    img.src = image;
    img.onload = () => {
      const canvas = isPreview ? preview.current : document.createElement("canvas");
      if (!isPreview) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = newData[i];
        data[i + 1] = newData[i + 1];
        data[i + 2] = newData[i + 2];
      }

      ctx.putImageData(imageData, 0, 0);
      if (isPreview) {
        ctx.drawImage(canvas.toDataURL("image/png"), 0, 0);
      } else {
        setImage(canvas.toDataURL("image/jpeg"));
        closeModal();
      }
    };
  };

  const handleCurvesConfirm = () => handleCurves(false);
  const handleCurvesPreview = () => handleCurves(true);
  const handleCurvesReset = () => {
    setInA(0);
    setOutA(0);
    setInB(255);
    setOutB(255);
  };

  const handlePreview = (value) => {
    setPreviewActive(value);
    showPreview(value);
    if (value) {
      handleCurvesPreview();
    } else {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        const canvas = imageCtx;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.current;
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  return (
    <form className="curves-modal form" onSubmit={(event) => event.preventDefault()}>
      <svg id="histogram" width="600" height="400"></svg>
      <div className="curves-modal__edit">
        <div className="curves-modal__table">
          <h3 className="curves-modal__name curves-modal__name--a">A</h3>
          <h3 className="curves-modal__name curves-modal__name--b">B</h3>
          <p className="curves-modal__type">Вход</p>
          <Input type="number" max={inB - 1} min={0} value={inA} onChange={setInA} />
          <Input type="number" max={255} min={inA + 1} value={inB} onChange={setInB} />
          <p className="curves-modal__type">Выход</p>
          <Input type="number" max={255} min={0} value={outA} onChange={setOutA} />
          <Input type="number" max={255} min={0} value={outB} onChange={setOutB} />
        </div>
        <div className="curves-modal__settings">
          <label htmlFor="previewCheckbox">Предварительный просмотр</label>
          <Input type="checkbox" name="previewCheckbox" id="previewCheckbox" onChange={handlePreview} />
        </div>
      </div>
      <canvas ref={preview} className={previewActive ? "curves-modal__preview--active" : "curves-modal__preview"}></canvas>
      <div className="curves-modal__actions">
        <TheButton className="curves-modal__button" normal shadow onClick={handleCurvesReset}>Сбросить</TheButton>
        <TheButton className="curves-modal__button" accent onClick={handleCurvesConfirm}>Применить</TheButton>
      </div>
    </form>
  );
};

CurvesModal.propTypes = {
  imageCtx: PropTypes.object,
  scaleFactor: PropTypes.number,
  setImage: PropTypes.func,
  closeModal: PropTypes.func,
  showPreview: PropTypes.func,
};

export default CurvesModal;
