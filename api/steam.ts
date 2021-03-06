import { supabase } from "./_lib/supabase"
import { initPage } from "./_lib/chromium"
import type { VercelRequest, VercelResponse } from "@vercel/node"
import verify from "./_lib/verify"
import { Page } from "puppeteer-core"

const scrapData = async (page: Page, query: any) => {
  return await page.$$eval(
    "#NewReleasesRows > a",
    (item, query: any) => {
      // Extract the item from the data
      return item.map((el) => {
        let link = el.getAttribute("href")
        let id = Number(link?.match(/app\/(.*?)\//i)?.[1])
        let image =
          el.querySelector(".tab_item_cap_img")?.getAttribute("src")?.replace("capsule_184x69", "header") ?? null
        let title = (el.querySelector(".tab_item_name") as HTMLElement)?.innerText ?? null
        let price =
          +(el.querySelector(".discount_final_price") as HTMLElement)?.innerText?.replace(/[^\d.-]/g, "") ?? null
        let tags = (el.querySelector(".tab_item_top_tags") as HTMLElement)?.innerText.split(", ") ?? null
        let platforms = [
          el.querySelector(".platform_img.win") ? "Windows" : null,
          el.querySelector(".platform_img.mac") ? "Mac" : null,
          el.querySelector(".platform_img.linux") ? "Linux" : null,
        ].filter((i) => i)

        let genre = query.genre as string
        return { id, link, image, title, price, tags, platforms, genre }
      })
    },
    query
  )
}

export default async (req: VercelRequest, res: VercelResponse) => {
  verify(req, res)
  var hrstart = process.hrtime()
  const { query } = req

  if (!query.genre || !query.page) {
    res.status(400).end("No genre or page found")
    return
  }

  try {
    const page = await initPage()
    await page.goto(`https://store.steampowered.com/tags/en/${query.genre}/#p=${+query.page * 3}&tab=NewReleases`)

    await page.waitForSelector("#NewReleasesTable")
    await page.waitForNetworkIdle()

    let data1 = await scrapData(page, query)

    await Promise.all([page.click("#NewReleases_btn_next"), page.waitForNavigation()])
    let data2 = await scrapData(page, query)

    await Promise.all([page.click("#NewReleases_btn_next"), page.waitForNavigation()])
    let data3 = await scrapData(page, query)

    const data = [...new Map([...data1, ...data2, ...data3].map((v) => [v.id, v])).values()]

    const result = await supabase.from("steam").upsert(data)
    if (result.error) throw new Error(result.error.message)

    var hrend = process.hrtime(hrstart)
    console.info("Execution time (hr): %ds %dms", hrend[0], hrend[1] / 1000000)
    res.status(200).end("success")
  } catch (err) {
    console.log({ err })
    res.status(500).end(err)
  }
}

// ** Genre **
// Free to Play
// Early Access
// Action
// Adventure
// Casual
// Indie
// Massively Multiplayer
// Racing
// RPG
// Simulation
// Sports
// Strategy
