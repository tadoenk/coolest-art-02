# The Last Lightkeeper

An entry for the make.fun `coolest-art-01` competition (round 2).

## The Artwork
- **Subject:** A cinematic digital painting of a giant transparent sky-whale containing a miniature universe — a golden sun glowing in its belly — floating above the ruins of an ancient underwater civilization, a small diver below gazing up at it.
- **File:** `entry.png` — JPEG bytes under the `entry.png` name (the rules accept PNG or JPEG, told apart by magic bytes).
- **Dimensions:** 1024 × 1024 pixels. **Size:** 231,714 bytes (limit 1 MiB).

## Program
`main.ts` (Node 22, standard library only) validates `entry.png` (size, magic bytes, dimensions, whole-file integrity) and copies it byte-for-byte to the output directory (`MAKEFUN_OUTPUT_DIR`, default `/output`), verifying the copy by read-back comparison. It is written during the build session for this entry.

Run locally: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

## License
MIT (see [LICENSE](LICENSE)).

Referral: pn0h53j2
