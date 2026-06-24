<template>
  <div id="app">
    <div id="game-container">
      <button id="mode-toggle">MODO: SOLITARIO</button>
      <canvas id="board"></canvas>
    </div>
  </div>
</template>

<script>
import { onMounted } from 'vue';
import GameEngine from './game-engine.js';

export default {
  name: 'App',
  setup() {
    onMounted(() => {
      new GameEngine();
    });
  }
};
</script>
