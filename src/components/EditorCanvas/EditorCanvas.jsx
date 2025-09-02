import React from 'react';

const EditorCanvas = ({ 
  canvasRef, 
  toolActive, 
  isMouseWheelDown, 
  handleCanvasClick, 
  handleMouseMove, 
  handleMouseDownEvent, 
  handleMouseUpEvent, 
  handleKeyDownEvent, 
  handleKeyUpEvent, 
  isModalOpen 
}) => {
  return (
    <div className={`editor__workspace workspace${toolActive === "hand" || isMouseWheelDown ? " workspace--hand" : ""}`}>
      <canvas
        className={`workspace__canvas${toolActive === "pipette" ? " workspace__canvas--pipette" : ""}`}
        ref={canvasRef}
        onClick={(e) => {
          if (toolActive === "pipette") {
            handleCanvasClick(e);
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDownEvent}
        onMouseUp={handleMouseUpEvent}
        onKeyDown={!isModalOpen ? handleKeyDownEvent : null}
        onKeyUp={!isModalOpen ? handleKeyUpEvent : null}
        style={{ cursor: toolActive === "hand" || isMouseWheelDown ? "grab" : toolActive === "pipette" ? "crosshair" : "default" }}
      />
    </div>
  );
};

export default EditorCanvas;