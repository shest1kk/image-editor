import React from 'react';
import ButtonIcon from "@components/ButtonIcon/ButtonIcon";

const ToolPanel = ({ selectedTool, setSelectedTool, setToolActive, setInfoActive, setIsContextModalOpen, isMouseWheelDown }) => {
  return (
    <div className="editor__tool-panel tool-panel">
      {["cursor", "pipette", "hand"].map((tool) => (
        <ButtonIcon
          key={tool}
          title={tool === "cursor" ? "Курсор" : tool === "pipette" ? "Пипетка" : "Рука"}
          onClick={() => {
            setSelectedTool(tool);
            setToolActive(tool);
            if (tool === "pipette") {
              setInfoActive(true);
              setIsContextModalOpen(true);
            } else {
              // Закрываем модальное окно пипетки при выборе других инструментов
              setInfoActive(false);
              setIsContextModalOpen(false);
            }
          }}
          active={selectedTool === tool || (isMouseWheelDown && tool === "hand")}
          tooltip={tool === "cursor" ? "Обычный указатель для работы с объектами и сброса других инструментов." : tool === "pipette" ? "Инструмент пипетки позволяет выбирать цвета изображения." : "Инструмент для перемещения области просмотра изображения. Удерживайте Shift для точного позиционирования."}
        >
          <svg className="tool-panel__icon" role="img" fill="currentColor" viewBox={tool === "cursor" ? "0 0 18 18" : tool === "pipette" ? "0 0 18 18" : "0 0 512 512"} width="18" height="18" aria-hidden="true" focusable="false">
            {tool === "cursor" ? (
              <path fillRule="evenodd" d="M4.252,1.027A.25.25,0,0,0,4,1.277V17.668a.25.25,0,0,0,.252.25.246.246,0,0,0,.175-.074L9.262,13h6.5a.25.25,0,0,0,.176-.427L4.427,1.1A.246.246,0,0,0,4.252,1.027Z"></path>
            ) : tool === "pipette" ? (
              <path fillRule="evenodd" d="M11.228,8.519,4.116,15.631a1.235,1.235,0,1,1-1.747-1.747L9.481,6.772Zm3.636-7.466a1.8,1.8,0,0,0-1.273.527L11.328,3.843l-.707-.707a.5.5,0,0,0-.707,0L8.234,4.817a.5.5,0,0,0,0,.707l.54.54L1.662,13.177a2.235,2.235,0,1,0,3.161,3.161l7.113-7.112.54.54a.5.5,0,0,0,.707,0l1.681-1.68a.5.5,0,0,0,0-.707l-.707-.707L16.42,4.409a1.8,1.8,0,0,0,0-2.546l-.283-.283a1.8,1.8,0,0,0-1.273-.527Z"></path>
            ) : (
              <path d="M82.42,209.08h0c15.06-6.62,32.38,1.31,38.5,17.62L156,312h11.27V80c0-17.6,13.3-32,29.55-32h0c16.26,0,29.55,14.4,29.55,32V231.75l14.78.25V32c0-17.6,13.3-32,29.55-32h0C287,0,300.25,14.4,300.25,32V231.75L315,232V64c0-17.6,13.3-32,29.55-32h0C434.7,96,448,110.4,448,128V344c0,75.8-37.13,168-169,168-40.8,0-79.42-7-100.66-21a121.41,121.41,0,0,1-33.72-33.31,138,138,0,0,1-16-31.78L66.16,250.77C60.05,234.46,67.36,215.71,82.42,209.08Z" />
            )}
          </svg>
        </ButtonIcon>
      ))}

      <ButtonIcon
        title="Информация"
        onClick={() => {
          setInfoActive((prev) => !prev);
          setIsContextModalOpen((prev) => !prev);
        }}
        active={selectedTool === "pipette"}
        tooltip="Показать информацию о цветах, выбранных с помощью пипетки."
      >
        <svg className="tool-panel__icon" role="img" fill="currentColor" viewBox="0 0 32 32" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
          <g data-name="Layer 2" id="Layer_2">
            <path d="M16,12a2,2,0,1,1,2-2A2,2,0,0,1,16,12Zm0-2Z" />
            <path d="M16,29A13,13,0,1,1,29,16,13,13,0,0,1,16,29ZM16,5A11,11,0,1,0,27,16,11,11,0,0,0,16,5Z" />
            <path d="M16,24a2,2,0,0,1-2-2V16a2,2,0,0,1,4,0v6A2,2,0,0,1,16,24Zm0-8v0Z" />
          </g>
        </svg>
      </ButtonIcon>
    </div>
  );
};

export default ToolPanel;