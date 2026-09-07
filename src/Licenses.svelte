<script lang="ts">
    import { cubicInOut } from "svelte/easing";
    import { fade } from "svelte/transition";

    let license = $state("2016-2025 Svelte Contributors");
    const {callback}: {callback: () => void} = $props();
</script>

<div class="dialog" in:fade={{duration: 300, easing: cubicInOut}} out:fade={{duration: 300, easing: cubicInOut}}>
    <div>
        <h2>Licenses:</h2>
        <select bind:value={license}>
            <option value="2016-2025 Svelte Contributors">Svelte</option>
            <option value="2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso">jszip</option>
            <option value="2020 Microsoft Corporation">Microsoft's Fluent UI Icons</option>
            <option value="2026 Dinoosauro">Fluent Icons Viewer</option>
        </select><br><br>
        <div class="card" style="background-color: var(--secondcard);">
            <p>MIT License<br><br>

Copyright (c) {license}<br><br>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:<br><br>

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.<br><br>

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
</p>
        </div><br>
        <button onclick={() => callback()}>Close</button>
    </div>
</div>

