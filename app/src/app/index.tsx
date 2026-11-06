import { parseContentBundle } from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { HomeScreen } from '../components/HomeScreen';

const bundle = parseContentBundle(sample);

export default function Index() {
  return <HomeScreen skills={bundle.skills} />;
}
