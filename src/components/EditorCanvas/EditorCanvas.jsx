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
  isModalOpen,
  scrollRef,
  showScrollbars,
  onScroll
}) => {
  return (
    <div className={`editor__workspace workspace${toolActive === "hand" || isMouseWheelDown ? " workspace--hand" : ""}`}>
      <div 
        className={`workspace__scroll-container${showScrollbars ? " workspace__scroll-container--scrollable" : ""}`}
        ref={scrollRef}
        onScroll={onScroll}
      >
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
          onMouseLeave={handleMouseUpEvent}
          onKeyDown={!isModalOpen ? handleKeyDownEvent : null}
          onKeyUp={!isModalOpen ? handleKeyUpEvent : null}
          style={{ cursor: toolActive === "hand" || isMouseWheelDown ? "grab" : toolActive === "pipette" ? "crosshair" : "default" }}
        />
      </div>
    </div>
  );
};

export default EditorCanvas;