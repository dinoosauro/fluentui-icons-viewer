<script lang="ts">
    import type {JSZipFileOptions} from "jszip";
    import { onMount } from "svelte";
    import Licenses from "./Licenses.svelte";
    interface FluentExplorer {
      /**
       * Icon name
       */
      name: string,
      /**
       * A list of all the available icon codes (so, all the relative paths, without the last extension, of the icon images)
       */
      iconList: string[]
    }
    interface RealJsZipFileOptions extends JSZipFileOptions {
      async: (type: "uint8array") => Promise<Uint8Array<ArrayBuffer>>
    }
    /**
     * A list of all the icons that have been fetched
     */
    let fetchedIcons: FluentExplorer[] = [];
    /**
     * The icons that are currently being displayed. This might be different from the `fetchedIcons` list since it could have been filtered by the search function.
     */
    let availableIcons = $state<FluentExplorer[]>([]);
    /**
     * An object that contains all the entries of the loaded zip file. If not loaded, it'll be an empty object.
     */
    let entries: {[key: string]: RealJsZipFileOptions} = {};

    /**
     * A map used to store fetched image Blobs. The keys follow this syntax: `*file format*-*size*-*name*`
     */
    let blobStorage = new Map<string, Blob>([]);
    let settings = $state({
      downloadPdf: false,
      copyToClipboard: false,
      type: "regular",
      iconSize: 24,
      keepElementsInMemory: false,
      darkMode: true,
      ...JSON.parse(localStorage.getItem("FluentUIViewer-Settings") ?? "{}"),
    })
    let spinner = Object.assign(document.createElement("div"), {className: "spinner"});
    $effect(() => {localStorage.setItem("FluentUIViewer-Settings", JSON.stringify(settings))}); // Store changes in the settings
    /**
     * Get the URL of an icon
     * @param icon the FluentExplorer object tied to this icon
     * @param forceSvg if true, the svg path will be returned even if `settings.downloadPdf` is set to true
     * @param position which of the icon scales contained in the `iconList` object should be downloaded. For example, if the iconList contains something like `[...16px, ...20px, ...24px]`, and this value is set to `1`, the `...20px` icon will be downloaded.
     */
  async function getIconUrl(icon: FluentExplorer, forceSvg?: boolean, position = 0) {
    const keys = Object.keys(entries);
    if (keys.length !== 0) { // Zip mode enabled: let's look inside the zip file so that we can find the icon
      const px = getAvailableSizes(icon)[position];
      const id = `${settings.downloadPdf && !forceSvg ? "pdf" : "svg"}-${px}-${icon.name}`;
      let blob = blobStorage.get(id);
      if (!blob) { // Let's try looking in the zip file if we can find this icon
        const entry = keys.find(i => {
          const pathSplit = i.split("/");
          return pathSplit[pathSplit.length - 1].endsWith(`_${px}_${settings.type}.${settings.downloadPdf && !forceSvg ? "pdf" : "svg"}`) && pathSplit[pathSplit.length - 3] === icon.name;
        });
        if (entry) {
          blob = new Blob([await entries[entry].async("uint8array")], settings.downloadPdf && !forceSvg ? undefined : {type: "image/svg+xml"});
          blobStorage.set(id, blob);
        }
      }
      if (blob) return URL.createObjectURL(blob);
    }
    return `https://raw.githubusercontent.com/microsoft/fluentui-system-icons/refs/heads/main/assets/${icon.name}/${settings.downloadPdf && !forceSvg ? "PDF" : "SVG"}/${icon.iconList[position]}.${settings.downloadPdf && !forceSvg ? "pdf" : "svg"}`;
  }
  /**
   * Read the loaded zip file (from the `entries` object), and show all the icons available in the zip file.
   */
  async function fetchOffline() {
    const markdown = Object.keys(entries).find(i => { // Let's first find the markdown file that contains the list of all the icons
      const name = i.split("/").pop();
      return name === `icons_${settings.type}.md`;
    });
    if (markdown) { // Now, let's read the file and parse it
      const text = await new Blob([await entries[markdown].async("uint8array")]).text();
      fetchedIcons = readMarkdown(text.split("\n"));
    } else alert("The requested icon type couldn't be found in the provided zip file.");
    availableIcons = fetchedIcons;
  }
  /**
   * Read the markdown file with the table containing all the icons
   * @param res the markdown file, divided by new line.
   */
  function readMarkdown(res: string[]) {
    const tempIcons: FluentExplorer[] = [];
      for (const row of res.slice(res.findIndex(i => i.startsWith("|---|")) + 1)) { 
        const cells = row.split("|");
        if (cells.length < 2) continue;
        const iconId = cells.find(i => i.startsWith("`ic_fluent")); // Let's find the cell where the icon id is included
        if (iconId) {
          tempIcons.push({name: cells[1].trim(), iconList: iconId.replaceAll("`", "").split("<br />")});
          continue;
        }
        tempIcons.push({name: cells[1].trim(), iconList: [row.substring(row.indexOf("ic_fluent"), row.indexOf(".", row.indexOf("ic_fluent")))]}); // Let's find it from the image source
      }
      return tempIcons;
  }
  /**
   * Get the markdown file containing all the icons from GitHub, and parse it
   */
  async function fetchOnline() {
    if (fetchedIcons.length === 0) {
      const req = await fetch(`https://raw.githubusercontent.com/microsoft/fluentui-system-icons/main/icons_${settings.type}.md`);
      const res = (await req.text()).split("\n");
      fetchedIcons = readMarkdown(res);
    }
    availableIcons = fetchedIcons;
  }
  /**
   * Get a list of all the available sizes of the passed icon
   * @param icon the object of the icon
   */
  function getAvailableSizes(icon: FluentExplorer) {
    return icon.iconList.map(i => {const temp = i.split("_"); return temp[temp.length - 2]});
  }
  /**
   * The text the user has written in the search input
   */
  let filterText = "";
  onMount(() => {
    document.body.style.setProperty("--icon-size", `${settings.iconSize}px`);
    window.addEventListener("scrollend", () => checkSizing());
  })

  /**
   * Show from icon number *this*-100 to icon number *this*
   */
  let loadedIcons = $state(100);
  /**
   * Function to call to revoke the object URL of the icons
   * @param node the image where the object url has been added
   * @param icon the icon that has been added
   */
  function revokeObjectURL(node: HTMLImageElement, icon: FluentExplorer) {
    return {
      destroy: () => {
        URL.revokeObjectURL(node.src);
        if (!settings.keepElementsInMemory) {
          for (const size of getAvailableSizes(icon)) {
            for (const extension of ["svg", "pdf"]) blobStorage.delete(`${extension}-${size}-${icon.name}`);
          }
        }
      }
    }
  }
  /**
   * Observer used to load the next icons
  */
  const addObserver = new IntersectionObserver((elements) => {
    if (elements[0].isIntersecting) loadedIcons = Math.min(loadedIcons + 15, availableIcons.length);
  });
  /**
   * Observer used to load the previous icons
   */
  const removeObserver = new IntersectionObserver((elements) => {
    if (elements[0].isIntersecting) loadedIcons = Math.max(100, loadedIcons - 15);
  })
  /**
   * The table row used as a placeholder for the rows that have been previously loaded, but removed from the DOM to save memory.
   */
  let lessSpace: HTMLElement;
  /**
   * The table row used as a placeholder for the rows that still need to be loaded.
   */
  let moreSpace: HTMLElement | undefined;
  /**
   * Function used to add the events to load more/less icon rows
   * @param node the node where the event should be added
   * @param increase if the `loadedIcons` property should increase (= see the next icons) instead of decrease (= see the previous icons)
   */
  function visibilityChange(node: HTMLElement, increase: boolean) {
    (increase ? addObserver : removeObserver).disconnect();
    (increase ? addObserver : removeObserver).observe(node);
    return {
      destroy: () => {
        (increase ? addObserver : removeObserver).unobserve(node);
      }
    }
  }
  /**
   * Check if an element is being currently displayed
   * @param elm the HTMLElement to check
   */
  function checkVisible(elm: HTMLElement) {
    const rect = elm.getBoundingClientRect();
    const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
  }

  /**
   * Update the `loadedIcons` property until the user no longer sees the placeholder rows
   */
  function checkSizing() {
    if (moreSpace && checkVisible(moreSpace)) {
      loadedIcons = Math.min(loadedIcons + 15, availableIcons.length);
      return;
    }
    if (checkVisible(lessSpace)) loadedIcons = Math.max(100, loadedIcons - 15);
  }

  $effect(() => { // When the loadedIcons object changes, check that the placeholder divs are no longer visible
    function registerComponents(_: any) {};
    registerComponents(loadedIcons);
    checkSizing();
  })

  $effect(() => { // When the user changes the icon type, refresh the icons
    function registerComponents(_: any) {};
    registerComponents(settings.type);
    fetchedIcons = [];
    availableIcons = [];
    document.body.append(spinner);
    if (Object.keys(entries).length !== 0) {
      fetchOffline().then(() => (spinner.remove()));
      return;
    }
    fetchOnline().then(() => (spinner.remove()));
  })

  /**
   * An array that contains [the CSS proprety name, its value in light mode]
   */
  const cssProperties = [["background", "#fafafa"], ["text", "#151515"], ["card", "#d2d2d2"], ["secondcard", "#a7a7a7"], ["accent", "#b6c28f"], ["img-filter", " "]];
  $effect(() => { // Change theme
    (document.querySelector("link[rel=icon]") as HTMLLinkElement).href = `./favicon${settings.darkMode ? "-light" : ""}.svg`;
    if (settings.darkMode) {
      for (const [name] of cssProperties) document.body.style.removeProperty(`--${name}`);
      return;
    } 
    for (const [name, value] of cssProperties) document.body.style.setProperty(`--${name}`, value);
  })
  /**
   * If true, the license dialog will be shown
   */
  let showLicenses = $state(false);
</script>

<div class="flex hcenter gap">
  <img src={`./favicon${settings.darkMode ? "-light" : ""}.svg`} alt="Application logo" style="width: 48px; height: 48px">
  <h1>Fluent UI Icons Viewer</h1>
</div>
<p>View, search and download Microsoft's Fluent UI icons.</p>
<div class="card">
  <h2>Settings:</h2>
  <label class="flex hcenter gap">
    Icon type: <select bind:value={settings.type}>
      <option value="regular">Regular</option>
      <option value="filled">Filled</option>
      <option value="light">Light</option>
      <option value="color">Color</option>
    </select>
  </label><br>
  <label class="flex hcenter gap">
    <input type="checkbox" bind:checked={settings.downloadPdf}>Download the PDF version of the icon
  </label><br>
  <label class="flex hcenter gap">
    <input type="checkbox" bind:checked={settings.copyToClipboard}>Copy the icon's source SVG/PDF in the clipboard instead of downloading it
  </label><br>
  <label class="flex hcenter gap">
    Size of the icon column (in pixels): <input type="number" onchange={() => {
      document.body.style.setProperty("--icon-size", `${settings.iconSize}px`);
    }} bind:value={settings.iconSize}>
  </label><br>
  <label class="flex hcenter gap">
    <input type="checkbox" bind:checked={settings.keepElementsInMemory}>Keep the downloaded images in memory. This will make the website faster, but will consume more RAM
  </label><br>
  <label class="flex hcenter gap">
    <input type="checkbox" bind:checked={settings.darkMode}>Enable dark mode
  </label><br>
  <button onclick={async () => {
    const input = Object.assign(document.createElement("input"), {
      type: "file",
      onchange: async () => {
        if (!input.files) return;
        document.body.append(spinner);
        const zip = await import("jszip");
        const zipReader = await zip.loadAsync(input.files[0]);
        // @ts-ignore
        entries = zipReader.files
        fetchedIcons = [];
        availableIcons = [];
        await fetchOffline();
        spinner.remove();
      }
    });
    input.click();
  }}>Fetch the icons from the repository's downloaded zip</button>
</div><br>
    <input placeholder="Search an icon" type="text" bind:value={filterText} oninput={() => {
      let tempText = filterText;
      setTimeout(() => {
        if (tempText === filterText) availableIcons = fetchedIcons.filter(i => i.name.toLowerCase().indexOf(filterText.toLowerCase().trim()) !== -1);
      }, 150)
      
    }}><br><br>
<table>
  <thead>
    <tr>
      <th>Icon:</th>
      <th>Name:</th>
      <th>Available sizes (click to download):</th>
    </tr>
  </thead>
  <tbody>
    <tr bind:this={lessSpace} style={`height: ${Math.max(settings.iconSize + 22, 57.5) * (loadedIcons - 100)}px`} use:visibilityChange={false}></tr>
    {#each availableIcons as icon, i (icon.name)}
    {#if i > loadedIcons - 110 && i < loadedIcons}
    <tr>
      <td>
        {#await getIconUrl(icon, true)}
        {:then src}
        <img use:revokeObjectURL={icon} loading="lazy" {src} alt={icon.name}>
        {/await}
      </td>
      <td>{icon.name}</td>
      <td>
        <div class="flex gap" style="flex-wrap: wrap;">          
        {#each getAvailableSizes(icon) as size, i}
        <button onclick={async () => {
          const id = `${settings.downloadPdf ? "pdf" : "svg"}-${size}-${icon.name}`;
          let blob = blobStorage.get(id);
          if (!blob) {
            const req = await fetch(await getIconUrl(icon, undefined, i));
            blob = await req.blob();
            blobStorage.set(id, blob);
          }
          if (settings.copyToClipboard) {
            const request = navigator.clipboard.writeText(await blob.text()); // This is the maximum that can be done with the Clipboard API, unfortunately browsers don't permit to pass PDF and SVG mimetypes
            request.then(() => {
              alert("Icon copied to clipboard");
            })
            request.catch(() => {
              alert("The browser blocked the clipboard copy request. Please try again.");
            })
            return;
          }
          const a = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `${icon.name} (${size}px).${settings.downloadPdf ? "pdf" :  "svg"}`,
            target: "_blank"
          });
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          a.click();
        }}>{size}</button>
        {/each}
      </div>
      </td>
    </tr>    
    {/if}
    {/each}
    {#if loadedIcons < availableIcons.length}
    <tr bind:this={moreSpace} style={`height: ${Math.max(settings.iconSize + 20, 57.5) * (availableIcons.length - loadedIcons - 1)}px`} use:visibilityChange={true}></tr>
    {/if}
  </tbody>
</table><br><br>
<p>Fluent Icons Viewer – Version {window.version}</p>
<div class="flex gap" style="flex-wrap: wrap;">
  <a href="https://github.com/dinoosauro/fluentui-icons-viewer" target="_blank">View on GitHub</a>
  <button class="emptyBtn" onclick={() => (showLicenses = true)}>View licenses</button>
</div>

{#if showLicenses}
<Licenses callback={() => (showLicenses = false)}></Licenses>
{/if}