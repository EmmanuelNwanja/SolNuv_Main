import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/pitch",
      permanent: false,
    },
  };
};

export default function PitchDeckRedirectPage() {
  return null;
}
