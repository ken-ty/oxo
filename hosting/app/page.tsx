import GameBoard from './components/GameBoard';
import FirebaseConfig from './components/firebase-config';

export default function Home() {
  return (
    <main>
      <FirebaseConfig />
      <GameBoard />
    </main>
  );
}
