import { questionSpeech } from './speech';
import { afterFourteen, applePictures, fishCount, sampleItem } from './testing';

describe('questionSpeech', () => {
  it('reads only the narration when it already names every choice', () => {
    expect(questionSpeech(fishCount)).toEqual([fishCount.narration]);
    const thirtyFour = sampleItem('g1-numbers-to-50-tap-1', 'tap');
    expect(questionSpeech(thirtyFour)).toEqual([thirtyFour.narration]);
  });

  it('reads every choice, in screen order, when the narration misses one', () => {
    const reversed = [...applePictures.choices].reverse();
    expect(questionSpeech(applePictures, reversed)).toEqual([
      applePictures.narration,
      'Six apples',
      'Five apples',
    ]);
  });

  it('matches whole words, so "six" is not found in "sixteen"', () => {
    const item = { ...fishCount, narration: 'Seven, eight, or sixteen?' };
    expect(questionSpeech(item)).toHaveLength(4);
  });

  it('reads only the narration for keypad and number line items', () => {
    expect(questionSpeech(afterFourteen)).toEqual([afterFourteen.narration]);
  });
});
