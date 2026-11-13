import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { DRAG_SLOP, useDrag, type DragOptions } from './drag';

// RNTL's fireEvent calls the grab checks without an event, so these call the props directly.
const at = (pageX: number, pageY = 0) => ({ nativeEvent: { pageX, pageY } });

function Target(props: Partial<DragOptions>) {
  const drag = useDrag({ enabled: true, grab: 'move', ...props });
  return <View testID="target" {...drag} />;
}

const target = () => screen.getByTestId('target').props;

describe('useDrag', () => {
  it('waits past the slop before a move grab takes the touch', async () => {
    await render(<Target />);
    target().onStartShouldSetResponderCapture(at(100, 50));
    expect(target().onStartShouldSetResponder(at(100, 50))).toBe(false);
    expect(target().onMoveShouldSetResponder(at(100 + DRAG_SLOP, 50))).toBe(false);
    expect(target().onMoveShouldSetResponder(at(100 + DRAG_SLOP, 51))).toBe(true);
  });

  it('grabs on touch-down for a press grab', async () => {
    await render(<Target grab="press" />);
    expect(target().onStartShouldSetResponder(at(0))).toBe(true);
  });

  it('never grabs while disabled', async () => {
    await render(<Target enabled={false} />);
    target().onStartShouldSetResponderCapture(at(0));
    expect(target().onStartShouldSetResponder(at(0))).toBe(false);
    expect(target().onMoveShouldSetResponder(at(80))).toBe(false);
  });

  it('reports moves and the drop from where the finger went down', async () => {
    const onMove = jest.fn();
    const onDrop = jest.fn();
    await render(<Target onMove={onMove} onDrop={onDrop} />);
    target().onStartShouldSetResponderCapture(at(100, 50));
    target().onResponderMove(at(130, 40));
    expect(onMove).toHaveBeenLastCalledWith({ pageX: 130, pageY: 40, dx: 30, dy: -10 });
    target().onResponderRelease(at(140, 70));
    expect(onDrop).toHaveBeenCalledWith({ pageX: 140, pageY: 70, dx: 40, dy: 20 });
  });

  it('keeps the touch from a parent and cancels when it loses it anyway', async () => {
    const onCancel = jest.fn();
    await render(<Target onCancel={onCancel} />);
    expect(target().onResponderTerminationRequest()).toBe(false);
    target().onResponderTerminate();
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls the latest handlers after a rerender', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await render(<Target onMove={first} />);
    await rerender(<Target onMove={second} />);
    target().onResponderMove(at(5));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});
